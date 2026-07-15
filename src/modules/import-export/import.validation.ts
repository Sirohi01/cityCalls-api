import { z } from 'zod';

export const importEntityParamSchema = z.object({
  entity: z.string().min(1),
});

export const importQuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
  mode: z.enum(['partial', 'strict']).default('partial'),
});
