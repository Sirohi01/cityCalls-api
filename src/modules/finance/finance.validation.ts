import { z } from 'zod';
import { PAYMENT_METHODS } from './paymentReceipts.model';

const lineItemSchema = z.object({
  description: z.string().min(1),
  partId: z.string().optional(),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRateId: z.string().optional(),
});

export const createEstimateSchema = z.object({
  customerId: z.string(),
  branchId: z.string(),
  serviceRequestId: z.string().optional(),
  leadId: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  validUntil: z.coerce.date().optional(),
});

export const shareDocumentSchema = z.object({
  channels: z.array(z.enum(['EMAIL', 'WHATSAPP', 'IN_APP'])).min(1),
});

export const createDirectInvoiceSchema = z.object({
  customerId: z.string(),
  branchId: z.string(),
  serviceRequestId: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
  discount: z.number().nonnegative().default(0),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional(),
  proofUrl: z.string().optional(),
});

export const issueNoteSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  reason: z.string().min(1),
});

export const listFinanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  customerId: z.string().optional(),
  serviceRequestId: z.string().optional(),
});
