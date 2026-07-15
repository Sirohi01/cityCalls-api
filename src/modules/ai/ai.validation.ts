import { z } from 'zod';
import { AI_FEATURES } from './aiSettings.model';

export const updateAiSettingsSchema = z.object({
  provider: z.enum(['GEMINI', 'OPENAI']).optional(),
  model: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  featureFlags: z.record(z.enum(AI_FEATURES), z.boolean()).optional(),
  usageLimits: z
    .object({
      maxRequestsPerDay: z.coerce.number().int().min(0).optional(),
      maxTokensPerDay: z.coerce.number().int().min(0).optional(),
      perRoleMaxRequestsPerDay: z.record(z.string(), z.coerce.number().int().min(0)).optional(),
    })
    .optional(),
});

export const summarizeCallSchema = z
  .object({
    callId: z.string().optional(),
    text: z.string().max(10_000).optional(),
  })
  .refine((data) => !!data.callId || !!data.text, {
    message: 'Provide either callId or text',
    path: ['text'],
  });

export const classifyComplaintSchema = z.object({
  text: z.string().min(1).max(10_000),
  categories: z.array(z.string()).optional(),
});
