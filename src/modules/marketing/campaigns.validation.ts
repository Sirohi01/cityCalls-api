import { z } from 'zod';
import { CAMPAIGN_STATUSES } from './campaigns.model';

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL']),
  templateId: z.string(),
  audienceFilter: z
    .object({
      tags: z.array(z.string()).default([]),
      segments: z.array(z.string()).default([]),
      customerType: z.string().optional(),
    })
    .default({ tags: [], segments: [] }),
  scheduledAt: z.coerce.date().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
  templateId: z.string().optional(),
  audienceFilter: z
    .object({
      tags: z.array(z.string()).default([]),
      segments: z.array(z.string()).default([]),
      customerType: z.string().optional(),
    })
    .optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
});
