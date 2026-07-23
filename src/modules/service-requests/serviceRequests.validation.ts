import { z } from 'zod';
import { SERVICE_REQUEST_STATUSES, ASSIGNEE_TYPES } from './serviceRequests.model';

const addressSnapshotSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(4),
  country: z.string().default('India'),
});

export const createServiceRequestSchema = z.object({
  customerId: z.string(),
  customerProductId: z.string().optional(),
  addressSnapshot: addressSnapshotSchema,
  serviceId: z.string(),
  symptoms: z.array(z.string()).default([]),
  notes: z.string().optional(),
  images: z.array(z.string()).default([]),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  source: z.enum(['CUSTOMER_APP', 'CALL', 'LEAD_CONVERSION', 'WALK_IN']),
  relatedCallId: z.string().optional(),
  relatedLeadId: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  scheduledSlot: z.string().optional(),
});

export const changeStatusSchema = z.object({
  toStatus: z.enum(SERVICE_REQUEST_STATUSES),
  reason: z.string().optional(),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  idempotencyKey: z.string().optional(),
});

export const assignSchema = z.object({
  assigneeType: z.enum(ASSIGNEE_TYPES),
  assigneeId: z.string(),
  method: z.enum(['MANUAL', 'RULE_ENGINE', 'BYPASS']).default('MANUAL'),
  reason: z.string().optional(),
});

export const reassignSchema = assignSchema;

export const cancelSchema = z.object({
  reason: z.string().min(1),
});

export const reopenSchema = z.object({
  reason: z.string().min(1),
});

export const rescheduleSchema = z.object({
  scheduledDate: z.coerce.date(),
  scheduledSlot: z.string().min(1),
  reason: z.string().optional(),
});

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  remarks: z.string().optional(),
});

export const verifyCompletionOtpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit OTP'),
});

export const locationPingSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const listServiceRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  status_in: z.string().optional(),
  branchId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  customerId: z.string().optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
  vertical: z.string().optional(),
});
