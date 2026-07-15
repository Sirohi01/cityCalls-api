import { z } from 'zod';

export const reportKeyParamSchema = z.object({
  reportKey: z.string().min(1),
});

export const reportQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
