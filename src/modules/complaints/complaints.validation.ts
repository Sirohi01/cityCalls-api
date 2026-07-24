import { z } from 'zod';

export const createComplaintSchema = z.object({
  serviceRequestId: z.string().optional(),
  subject: z.string().min(2),
  description: z.string().min(1),
});

export const respondComplaintSchema = z.object({
  response: z.string().min(1),
  status: z.enum(['RESOLVED', 'CLOSED']).default('RESOLVED'),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

export const listComplaintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  customerId: z.string().optional(),
});
