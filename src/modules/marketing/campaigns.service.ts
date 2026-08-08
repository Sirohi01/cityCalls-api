import { CampaignModel } from './campaigns.model';
import { NotificationTemplateModel } from '../notifications/notificationTemplates.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { isEmailEnabled, sendEmail } from '../../lib/emailAdapter';
import { isWhatsAppEnabled, sendWhatsApp } from '../../lib/whatsappAdapter';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';
import { resolveCampaignAudience, summarizeAudience } from './campaignAudience.service';
import { CampaignRecipientModel } from './campaignRecipients.model';
import { env } from '../../config/env';

interface CreateCampaignInput {
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  templateId?: string;
  providerCampaignName?: string;
  templateParams?: string[];
  media?: { fileId?: string; url: string; filename: string };
  audienceFilter: {
    recipientTypes: Array<'CUSTOMER' | 'USER' | 'EMPLOYEE' | 'VENDOR' | 'VENDOR_TECHNICIAN' | 'MANUAL'>;
    tags?: string[];
    segments?: string[];
    customerType?: string;
    roles?: string[];
    branchIds?: string[];
    vendorIds?: string[];
    excludeMobiles?: string[];
    manualMobiles?: string[];
  };
  scheduledAt?: Date;
}

export async function createCampaign(input: CreateCampaignInput, actor: AccessTokenPayload) {
  const template = input.templateId
    ? await NotificationTemplateModel.findById(input.templateId)
    : await NotificationTemplateModel.findOne({ channel: input.channel, active: true });
  if (!template || template.channel !== input.channel) {
    throw new ConflictError('Template must exist and match the campaign channel', 'TEMPLATE_CHANNEL_MISMATCH');
  }
  return CampaignModel.create({
    ...input,
    templateId: template._id,
    providerCampaignName: input.channel === 'WHATSAPP'
      ? (input.providerCampaignName || env.aisensy.festivalCampaign)
      : input.providerCampaignName,
    templateParams: input.channel === 'WHATSAPP' && !input.templateParams?.length
      ? ['{{firstName}}', '{{firstName}}']
      : (input.templateParams ?? []),
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

export async function previewCampaignAudience(id: string) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  return summarizeAudience(await resolveCampaignAudience(campaign));
}

export async function sendCampaignNow(id: string, actor: AccessTokenPayload) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status === 'COMPLETED' || campaign.status === 'SENDING') {
    throw new ConflictError('Campaign has already been sent or is currently sending', 'CAMPAIGN_ALREADY_SENT');
  }
  const template = await NotificationTemplateModel.findById(campaign.templateId);
  if (!template) throw new NotFoundError('Campaign template not found');
  if (campaign.channel === 'WHATSAPP') {
    if (!isWhatsAppEnabled()) throw new ConflictError('AiSensy is not configured or enabled', 'WHATSAPP_INTEGRATION_DISABLED');
    if (!campaign.providerCampaignName) throw new ConflictError('AiSensy API campaign name is missing', 'AISENSY_CAMPAIGN_NAME_MISSING');
  } else if (!isEmailEnabled()) {
    throw new ConflictError('Email integration is not configured or enabled', 'EMAIL_INTEGRATION_DISABLED');
  }

  const audience = await resolveCampaignAudience(campaign);
  const eligible = audience.filter((recipient) => recipient.eligible);
  if (eligible.length === 0) {
    throw new ConflictError('No eligible recipients after consent, contact, exclusion, and deduplication checks', 'EMPTY_CAMPAIGN_AUDIENCE');
  }
  await CampaignRecipientModel.deleteMany({ campaignId: campaign._id });
  await CampaignRecipientModel.insertMany(
    eligible.map((recipient) => ({
      campaignId: campaign._id,
      recipientType: recipient.recipientType,
      recipientId: recipient.recipientId,
      name: recipient.name,
      destination: campaign.channel === 'WHATSAPP' ? recipient.mobile : recipient.email,
      status: 'QUEUED',
    }))
  );
  campaign.stats = { sent: 0, delivered: 0, read: 0, failed: 0 };
  campaign.status = 'SENDING';
  await campaign.save();

  await logActivity({
    entityType: 'CAMPAIGN',
    entityId: id,
    user: actor,
    action: 'QUEUED',
    module: 'marketing',
    newValue: { matchedRecords: audience.length, queuedRecipients: eligible.length },
  });
  return campaign;
}

function renderCampaignParam(value: string, recipientName: string, campaignName: string): string {
  const firstName = recipientName.trim().split(/\s+/)[0] || 'user';
  return value
    .replaceAll('{{firstName}}', firstName)
    .replaceAll('{{fullName}}', recipientName || 'user')
    .replaceAll('{{campaignName}}', campaignName);
}

export async function processQueuedCampaignRecipients(limit = 25): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const recipient = await CampaignRecipientModel.findOneAndUpdate(
      { status: 'QUEUED' },
      { $set: { status: 'SENDING' }, $inc: { attemptCount: 1 } },
      { new: true, sort: { queuedAt: 1 } }
    );
    if (!recipient) break;
    const campaign = await CampaignModel.findById(recipient.campaignId);
    const template = campaign ? await NotificationTemplateModel.findById(campaign.templateId) : null;
    try {
      if (!campaign || campaign.status !== 'SENDING') throw new Error('Campaign is no longer active');
      if (!template) throw new Error('Campaign template not found');
      if (campaign.channel === 'WHATSAPP') {
        if (!campaign.providerCampaignName) throw new Error('AiSensy campaign name is missing');
        const params = campaign.templateParams.map((value) => renderCampaignParam(value, recipient.name, campaign.name));
        const result = await sendWhatsApp({
          to: recipient.destination,
          campaignName: campaign.providerCampaignName,
          userName: recipient.name,
          variables: params,
          media: campaign.media?.url && campaign.media?.filename ? { url: campaign.media.url, filename: campaign.media.filename } : undefined,
          paramsFallbackValue: { FirstName: recipient.name.split(/\s+/)[0] || 'user' },
        });
        recipient.providerResponse = result.response;
      } else {
        await sendEmail({
          to: recipient.destination,
          subject: template.subjectTemplate ?? campaign.name,
          html: template.bodyTemplate.replaceAll('{{firstName}}', recipient.name.split(/\s+/)[0] || 'user'),
        });
      }
      recipient.status = 'SENT';
      recipient.sentAt = new Date();
    } catch (error) {
      recipient.status = 'FAILED';
      recipient.failureReason = error instanceof Error ? error.message : 'Unknown campaign delivery error';
    }
    await recipient.save();
    processed += 1;
  }
  await completeFinishedCampaigns();
  return processed;
}

async function completeFinishedCampaigns(): Promise<void> {
  const activeCampaignIds = await CampaignRecipientModel.distinct('campaignId', { status: { $in: ['QUEUED', 'SENDING'] } });
  const completing = await CampaignModel.find({ status: 'SENDING', _id: { $nin: activeCampaignIds } });
  for (const campaign of completing) {
    const [sent, failed] = await Promise.all([
      CampaignRecipientModel.countDocuments({ campaignId: campaign._id, status: { $in: ['SENT', 'DELIVERED', 'READ'] } }),
      CampaignRecipientModel.countDocuments({ campaignId: campaign._id, status: 'FAILED' }),
    ]);
    campaign.stats.sent = sent;
    campaign.stats.failed = failed;
    campaign.status = 'COMPLETED';
    await campaign.save();
  }
}

export async function queueDueScheduledCampaigns(): Promise<number> {
  const due = await CampaignModel.find({ status: 'SCHEDULED', scheduledAt: { $lte: new Date() } });
  let queued = 0;
  for (const campaign of due) {
    try {
      const audience = (await resolveCampaignAudience(campaign)).filter((recipient) => recipient.eligible);
      if (audience.length === 0) {
        campaign.status = 'CANCELLED';
        await campaign.save();
        continue;
      }
      await CampaignRecipientModel.insertMany(
        audience.map((recipient) => ({
          campaignId: campaign._id,
          recipientType: recipient.recipientType,
          recipientId: recipient.recipientId,
          name: recipient.name,
          destination: campaign.channel === 'WHATSAPP' ? recipient.mobile : recipient.email,
          status: 'QUEUED',
        })),
        { ordered: false }
      );
      campaign.status = 'SENDING';
      await campaign.save();
      queued += audience.length;
    } catch (error) {
      console.error(`[campaigns] failed to queue scheduled campaign ${campaign._id.toString()}`, error);
    }
  }
  return queued;
}

// A sent campaign (COMPLETED/CANCELLED) can't be edited or resent — see
// updateCampaign/sendCampaignNow's status guards — but recurring sends
// (a festival greeting, an annual promo) shouldn't mean rebuilding the
// template/audience/image from scratch every time. Duplicate clones
// everything into a fresh DRAFT the user can tweak (e.g. just the occasion
// name) and send again.
export async function duplicateCampaign(id: string, actor: AccessTokenPayload) {
  const source = await CampaignModel.findById(id);
  if (!source) throw new NotFoundError('Campaign not found');
  return CampaignModel.create({
    name: `${source.name} (Copy)`,
    channel: source.channel,
    templateId: source.templateId,
    providerCampaignName: source.providerCampaignName,
    templateParams: source.templateParams,
    media: source.media,
    audienceFilter: source.audienceFilter,
    status: 'DRAFT',
    createdBy: actor.sub,
  });
}

export async function updateCampaign(id: string, data: Record<string, unknown>) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status === 'SENDING' || campaign.status === 'COMPLETED') {
    throw new ConflictError('A sending or completed campaign cannot be edited', 'CAMPAIGN_NOT_EDITABLE');
  }
  Object.assign(campaign, data);
  await campaign.save();
  return campaign;
}

export async function deleteCampaign(id: string) {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status === 'SENDING') throw new ConflictError('A sending campaign cannot be deleted', 'CAMPAIGN_NOT_DELETABLE');
  await Promise.all([campaign.deleteOne(), CampaignRecipientModel.deleteMany({ campaignId: id })]);
}
