import { z } from 'zod';
import { COMPLETION_PROOF_TYPES } from './serviceVisits.model';

const partSchema = z.object({
  partId: z.string().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

export const updateInspectionSchema = z.object({
  defectFound: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  solutionType: z.string().optional(),
});

export const addPartsSchema = z.object({
  parts: z.array(partSchema).min(1),
});

export const updateWorkSchema = z.object({
  labourCharge: z.number().nonnegative().optional(),
  workNotes: z.string().optional(),
  beforeImages: z.array(z.string()).optional(),
  afterImages: z.array(z.string()).optional(),
  nextVisitDate: z.coerce.date().optional(),
});

export const completeVisitSchema = z.object({
  completionProof: z.object({
    type: z.enum(COMPLETION_PROOF_TYPES),
    value: z.string().optional(),
    url: z.string().optional(),
  }),
});

// One action within an offline-sync batch — docs/manish/09-vendor-app-functional-plan.md §2.
export const syncActionSchema = z.object({
  idempotencyKey: z.string().min(1),
  clientTimestamp: z.coerce.date(),
  actionType: z.enum(['START_VISIT', 'ARRIVE', 'UPDATE_INSPECTION', 'ADD_PARTS', 'UPDATE_WORK', 'COMPLETE_VISIT', 'STATUS_CHANGE']),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const syncBatchSchema = z.object({
  actions: z.array(syncActionSchema).min(1).max(100),
});
