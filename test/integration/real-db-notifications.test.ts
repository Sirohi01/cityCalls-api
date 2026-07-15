import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { UserModel } from '../../src/modules/users/users.model';
import { CustomerModel } from '../../src/modules/customers/customers.model';
import { NotificationTemplateModel, NotificationModel } from '../../src/modules/notifications/notificationTemplates.model';
import { CampaignModel } from '../../src/modules/marketing/campaigns.model';
import { trigger } from '../../src/lib/notifications';
import { createCampaign, sendCampaignNow } from '../../src/modules/marketing/campaigns.service';
import { AccessTokenPayload } from '../../src/lib/jwt';

// Real (in-memory) DB coverage for Phase 8's core acceptance criteria — per
// docs/13-notification-and-template-system.md and docs/01-business-requirements-document.md
// §3.6: disabling AiSensy/SMTP mid-operation must never block a core workflow
// action. No SMTP_HOST/AISENSY_API_KEY are set in the test environment, so
// isEmailEnabled()/isWhatsAppEnabled() are false here — exercising exactly
// that "integration disabled" path against real Mongoose writes.
describe('Notification trigger + campaign flow (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let actor: AccessTokenPayload;
  let customerId: string;

  beforeAll(async () => {
    await connectTestDb();

    const user = await UserModel.create({
      name: 'Admin',
      email: 'admin3@test.local',
      mobile: '9777777777',
      passwordHash: 'x',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    actor = { sub: user._id.toString(), role: 'SUPER_ADMIN' };

    // Has its own User account (mobile-app customer), so IN_APP delivery can resolve a userId.
    const customerUser = await UserModel.create({
      name: 'Notify Customer',
      email: 'notify-customer@test.local',
      mobile: '9111111111',
      passwordHash: 'x',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const customer = await CustomerModel.create({
      userId: customerUser._id,
      customerType: 'INDIVIDUAL',
      name: 'Notify Customer',
      email: 'notify-customer@test.local',
      contacts: [{ name: 'Notify Customer', mobile: '9111111111', isPrimary: true }],
      addresses: [{ line1: 'Flat 2', city: 'Delhi', state: 'Delhi', pinCode: '110002', country: 'India', isDefault: true }],
      consent: { whatsapp: 'GRANTED', email: 'GRANTED', sms: 'NOT_ASKED' },
    });
    customerId = customer._id.toString();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates SENT for IN_APP and SKIPPED_INTEGRATION_DISABLED for EMAIL/WHATSAPP when integrations are off', async () => {
    await NotificationTemplateModel.create([
      { triggerKey: 'TEST_TRIGGER', channel: 'IN_APP', bodyTemplate: 'Hello {{name}}', variables: ['name'] },
      { triggerKey: 'TEST_TRIGGER', channel: 'EMAIL', subjectTemplate: 'Hi {{name}}', bodyTemplate: 'Hello {{name}}', variables: ['name'] },
      { triggerKey: 'TEST_TRIGGER', channel: 'WHATSAPP', bodyTemplate: 'Hello {{name}}', variables: ['name'] },
    ]);

    await trigger('TEST_TRIGGER', {
      recipient: { customerId },
      variables: { name: 'Notify Customer' },
    });

    const notifications = await NotificationModel.find({ triggerKey: 'TEST_TRIGGER' });
    expect(notifications).toHaveLength(3);

    const inApp = notifications.find((n) => n.channel === 'IN_APP');
    expect(inApp?.status).toBe('SENT');

    const email = notifications.find((n) => n.channel === 'EMAIL');
    expect(email?.status).toBe('SKIPPED_INTEGRATION_DISABLED');
    expect(email?.body).toBe('Hello Notify Customer');

    const whatsapp = notifications.find((n) => n.channel === 'WHATSAPP');
    expect(whatsapp?.status).toBe('SKIPPED_INTEGRATION_DISABLED');
  });

  it('does not throw and creates nothing when no template is registered for the trigger', async () => {
    await expect(
      trigger('UNREGISTERED_TRIGGER', { recipient: { customerId }, variables: {} })
    ).resolves.toBeUndefined();

    const count = await NotificationModel.countDocuments({ triggerKey: 'UNREGISTERED_TRIGGER' });
    expect(count).toBe(0);
  });

  it('sends a campaign to consented audience and marks stats.failed when the channel integration is disabled', async () => {
    const template = await NotificationTemplateModel.create({
      triggerKey: 'CAMPAIGN_PROMO',
      channel: 'EMAIL',
      subjectTemplate: 'Promo',
      bodyTemplate: 'Special offer for you',
      variables: [],
    });

    const campaign = await createCampaign(
      {
        name: 'July Promo',
        channel: 'EMAIL',
        templateId: template._id.toString(),
        audienceFilter: {},
      },
      actor
    );

    const sent = await sendCampaignNow(campaign._id.toString(), actor);

    expect(sent.status).toBe('COMPLETED');
    expect(sent.stats.sent).toBe(0);
    expect(sent.stats.failed).toBe(1); // EMAIL integration disabled in test env, so the one consented customer counts as failed

    const persisted = await CampaignModel.findById(campaign._id);
    expect(persisted?.status).toBe('COMPLETED');
  });
});
