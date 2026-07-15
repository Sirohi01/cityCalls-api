import { z } from 'zod';
import { HAPPY_CALL_STATUSES } from './happyCalls.model';

export const recordHappyCallOutcomeSchema = z.object({
  status: z.enum(HAPPY_CALL_STATUSES),
  outcome: z.string().optional(),
  customerSatisfaction: z.number().min(1).max(5).optional(),
  remarks: z.string().optional(),
  reopenRequested: z.boolean().default(false),
  escalationRequired: z.boolean().default(false),
  nextFollowUpDate: z.coerce.date().optional(),
  recordingUrl: z.string().optional(),
});

export const reassignHappyCallSchema = z.object({
  assignedTo: z.string(),
});

export const listHappyCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(HAPPY_CALL_STATUSES).optional(),
  assignedTo: z.string().optional(),
});
