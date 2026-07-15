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

export const convertLeadSchema = z.object({
  convertTo: z.enum(['CUSTOMER', 'SERVICE_REQUEST']),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  name: z.string().min(2).optional(),
  addresses: z.array(z.record(z.string(), z.unknown())).default([]),
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
