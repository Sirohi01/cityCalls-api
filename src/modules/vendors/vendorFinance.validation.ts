import { z } from 'zod';

export const createVendorInvoiceSchema = z.object({
  vendorId: z.string(),
  serviceRequestIds: z.array(z.string()).min(1),
  grossAmount: z.number().positive(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
});

export const createVendorPayoutSchema = z.object({
  vendorId: z.string(),
  vendorInvoiceIds: z.array(z.string()).min(1),
});

export const markPayoutPaidSchema = z.object({
  reference: z.string().min(1),
});

export const listVendorFinanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  vendorId: z.string().optional(),
  status: z.string().optional(),
});
