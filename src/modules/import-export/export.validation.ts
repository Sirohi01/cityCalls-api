import { z } from 'zod';

export const exportEntityParamSchema = z.object({
  entity: z.string().min(1),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  columns: z.string().optional(), // comma-separated
});
