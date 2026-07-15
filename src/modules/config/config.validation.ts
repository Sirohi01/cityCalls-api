import { z } from 'zod';
import { MASTER_TYPES } from './master.model';

export const masterTypeParamSchema = z.object({
  masterType: z.enum(MASTER_TYPES),
});

export const createMasterSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  parentId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().default(0),
  active: z.boolean().default(true),
});

export const updateMasterSchema = createMasterSchema.partial();

export const listMastersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().optional(),
  parentId: z.string().optional(),
});
