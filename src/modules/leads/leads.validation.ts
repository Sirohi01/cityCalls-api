import { z } from 'zod';
import { LEAD_STAGES } from './leads.model';

export const createLeadSchema = z.object({
  source: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  ownerId: z.string(),
  customerId: z.string().optional(),
  contactName: z.string().optional(),
  contactMobile: z.string().optional(),
  productInterest: z.string().optional(),
  requirement: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
  branchId: z.string().optional(),
  campaignId: z.string().optional(),
});

export const updateLeadSchema = z.object({
  ownerId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  productInterest: z.string().optional(),
  requirement: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
  score: z.number().optional(),
});

export const changeLeadStageSchema = z.object({
  toStage: z.enum(LEAD_STAGES),
  lostReason: z.string().optional(),
});

export const addLeadNoteSchema = z.object({
  text: z.string().min(1),
});

const addressSnapshotSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(4),
  country: z.string().default('India'),
});

export const convertLeadSchema = z
  .object({
    convertTo: z.enum(['CUSTOMER', 'SERVICE_REQUEST']),
    customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
    name: z.string().min(2).optional(),
    addresses: z.array(addressSnapshotSchema).default([]),
    // Required only when convertTo === 'SERVICE_REQUEST' — a Lead doesn't carry
    // a structured service/address/symptoms, so conversion needs them supplied.
    serviceId: z.string().optional(),
    addressSnapshot: addressSnapshotSchema.optional(),
    symptoms: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.convertTo === 'SERVICE_REQUEST') {
      if (!data.serviceId) {
        ctx.addIssue({ code: 'custom', path: ['serviceId'], message: 'serviceId is required to convert a lead into a service request' });
      }
      if (!data.addressSnapshot) {
        ctx.addIssue({ code: 'custom', path: ['addressSnapshot'], message: 'addressSnapshot is required to convert a lead into a service request' });
      }
    }
  });

export const bulkAssignLeadsSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  ownerId: z.string(),
});

export const mergeLeadsSchema = z.object({
  primaryLeadId: z.string(),
  duplicateLeadId: z.string(),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stage: z.enum(LEAD_STAGES).optional(),
  ownerId: z.string().optional(),
  source: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  q: z.string().optional(),
});
