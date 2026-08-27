import { z } from 'zod';
import { CAMPAIGN_RECIPIENT_TYPES, CAMPAIGN_STATUSES } from './campaigns.model';
import { ROLES } from '../users/users.types';

const audienceFilterSchema = z.object({
  recipientTypes: z.array(z.enum(CAMPAIGN_RECIPIENT_TYPES)).min(1).default(['CUSTOMER']),
  tags: z.array(z.string()).default([]),
  segments: z.array(z.string()).default([]),
  customerType: z.string().optional(),
  roles: z.array(z.enum(ROLES)).default([]),
  branchIds: z.array(z.string()).default([]),
  vendorIds: z.array(z.string()).default([]),
  excludeMobiles: z.array(z.string()).default([]),
  manualMobiles: z.array(z.string()).max(1000).default([]),
});

const mediaSchema = z.object({
  fileId: z.string().optional(),
  url: z.string().url(),
  filename: z.string().min(1),
});

const carouselCardSchema = z.object({
  cardIndex: z.number().int().min(0),
  imageUrl: z.string().url(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL']),
  templateId: z.string().optional(),
  providerCampaignName: z.string().trim().optional(),
  // Lets the client pick a named, pre-approved AiSensy campaign (its real
  // name lives only in .env) instead of needing to know/duplicate the
  // literal campaign name string itself.
  campaignPreset: z.enum(['FESTIVAL', 'INDEPENDENCE_DAY']).optional(),
  templateParams: z.array(z.string()).default([]),
  media: mediaSchema.optional(),
  carouselCards: z.array(carouselCardSchema).max(10).optional(),
  audienceFilter: audienceFilterSchema.default({ recipientTypes: ['CUSTOMER'], tags: [], segments: [], roles: [], branchIds: [], vendorIds: [], excludeMobiles: [], manualMobiles: [] }),
  scheduledAt: z.coerce.date().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
  templateId: z.string().optional(),
  providerCampaignName: z.string().trim().optional(),
  templateParams: z.array(z.string()).optional(),
  media: mediaSchema.optional(),
  carouselCards: z.array(carouselCardSchema).max(10).optional(),
  audienceFilter: audienceFilterSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
});
