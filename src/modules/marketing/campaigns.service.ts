import { CampaignModel } from './campaigns.model';
import { NotificationTemplateModel } from '../notifications/notificationTemplates.model';
import { CustomerModel } from '../customers/customers.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { isEmailEnabled, sendEmail } from '../../lib/emailAdapter';
import { isWhatsAppEnabled, sendWhatsApp } from '../../lib/whatsappAdapter';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

interface CreateCampaignInput {
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  templateId: string;
  audienceFilter: { tags?: string[]; segments?: string[]; customerType?: string };
  scheduledAt?: Date;
}

export async function createCampaign(input: CreateCampaignInput, actor: AccessTokenPayload) {
  const template = await NotificationTemplateModel.findById(input.templateId);
  if (!template || template.channel !== input.channel) {
    throw new ConflictError('Template must exist and match the campaign channel', 'TEMPLATE_CHANNEL_MISMATCH');
  }

  return CampaignModel.create({
    name: input.name,
    channel: input.channel,
    templateId: input.templateId,
    audienceFilter: input.audienceFilter,
    scheduledAt: input.scheduledAt,
    status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    createdBy: actor.sub,
  });
}

export async function listCampaigns(params: { page: number; limit: number; status?: string; channel?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.channel) filter.channel = params.channel;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    CampaignModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    CampaignModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getCampaign(id: string) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  return campaign;
}

function resolveAudienceQuery(filter: { tags?: string[]; segments?: string[]; customerType?: string }): Record<string, unknown> {
  const query: Record<string, unknown> = { blacklisted: { $ne: true } };
  if (filter.tags?.length) query.tags = { $in: filter.tags };
  if (filter.segments?.length) query.segments = { $in: filter.segments };
  if (filter.customerType) query.customerType = filter.customerType;
  return query;
}

// Sends to the filtered audience, honoring marketing consent for the
// campaign's channel specifically — per docs/15-whatsapp-marketing /
// docs/16-email-marketing: campaigns are gated by marketing consent, not the
// narrower transactional-consent assumption the trigger() engine uses.
export async function sendCampaignNow(id: string, actor: AccessTokenPayload) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status === 'COMPLETED' || campaign.status === 'SENDING') {
    throw new ConflictError('Campaign has already been sent or is currently sending', 'CAMPAIGN_ALREADY_SENT');
  }

  const template = await NotificationTemplateModel.findById(campaign.templateId);
  if (!template) throw new NotFoundError('Campaign template not found');

  campaign.status = 'SENDING';
  await campaign.save();

  const consentField = campaign.channel === 'WHATSAPP' ? 'consent.whatsapp' : 'consent.email';
  const audience = await CustomerModel.find({
    ...resolveAudienceQuery(campaign.audienceFilter),
    [consentField]: 'GRANTED',
  });

  const channelReady = campaign.channel === 'WHATSAPP' ? isWhatsAppEnabled() : isEmailEnabled();

  for (const customer of audience) {
    if (!channelReady) {
      campaign.stats.failed += 1;
      continue;
    }
    try {
      if (campaign.channel === 'EMAIL') {
        if (!customer.email) throw new Error('No email on file');
        await sendEmail({ to: customer.email, subject: template.subjectTemplate ?? campaign.name, html: template.bodyTemplate });
      } else {
        const mobile = customer.contacts.find((c) => c.isPrimary)?.mobile ?? customer.contacts[0]?.mobile;
        if (!mobile) throw new Error('No mobile on file');
        await sendWhatsApp({ to: mobile, templateName: template.triggerKey, variables: [] });
      }
      campaign.stats.sent += 1;
    } catch {
      campaign.stats.failed += 1;
    }
  }

  campaign.status = 'COMPLETED';
  await campaign.save();

  await logActivity({
    entityType: 'CAMPAIGN',
    entityId: id,
    user: actor,
    action: 'SENT',
    module: 'marketing',
    newValue: { audienceSize: audience.length, stats: campaign.stats, channelWasEnabled: channelReady },
  });

  return campaign;
}

export async function updateCampaign(id: string, data: Record<string, unknown>) {
  const campaign = await CampaignModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!campaign) throw new NotFoundError('Campaign not found');
  return campaign;
}

export async function deleteCampaign(id: string) {
  const campaign = await CampaignModel.findByIdAndDelete(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
}
