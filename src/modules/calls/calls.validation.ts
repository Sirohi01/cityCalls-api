import { z } from 'zod';
import { CALL_TYPES, CALL_DIRECTIONS } from './calls.model';

// Per-call-type details schemas — docs/03-screenshot-and-excel-analysis.md §3 and
// docs/06-complete-workflow-document.md. One Zod schema per callType, dispatched
// by a discriminated check rather than one flat "any field goes" shape, per
// docs/manish/05-module-wise-backend-plan.md §Calls.
const initialDetailsSchema = z.object({
  brandId: z.string().optional(),
  productTypeId: z.string().optional(),
  productAge: z.string().optional(),
  serialNumber: z.string().optional(),
  modelNumber: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  initialComplaint: z.string().optional(),
  requirement: z.string().optional(),
});

const requirementDetailsSchema = z.object({
  exactRequirement: z.string().optional(),
  warrantyStatus: z.enum(['IN_WARRANTY', 'OUT_OF_WARRANTY', 'UNKNOWN']).optional(),
  appointmentPreference: z.string().optional(),
  addressVerified: z.boolean().default(false),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  remoteResolutionPossible: z.boolean().optional(),
  shouldCreateServiceRequest: z.boolean().default(true),
});

const preServiceDetailsSchema = z.object({
  appointmentConfirmed: z.boolean().default(false),
  technicianConfirmed: z.boolean().default(false),
  addressConfirmed: z.boolean().default(false),
  visitChargeConfirmed: z.boolean().default(false),
  timeSlotConfirmed: z.boolean().default(false),
  rescheduleReason: z.string().optional(),
  customerUnreachable: z.boolean().default(false),
});

const visitUpdateDetailsSchema = z.object({
  visitStatus: z.enum(['STARTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CUSTOMER_UNAVAILABLE']).optional(),
  actualDefectFound: z.string().optional(),
  solutionType: z.string().optional(),
  partName: z.string().optional(),
  partQuantity: z.number().optional(),
  partPrice: z.number().optional(),
  labourCharge: z.number().optional(),
  actualSolution: z.string().optional(),
  beforeImages: z.array(z.string()).default([]),
  afterImages: z.array(z.string()).default([]),
  paymentStatus: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID']).optional(),
});

const postServiceFollowupDetailsSchema = z.object({
  customerSatisfaction: z.number().min(1).max(5).optional(),
  serviceCompletedConfirmation: z.boolean().optional(),
  technicianBehaviour: z.string().optional(),
  productWorkingStatus: z.enum(['WORKING', 'NOT_WORKING', 'PARTIALLY_WORKING']).optional(),
  repeatIssue: z.boolean().default(false),
  feedback: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

const happyCallDetailsSchema = z.object({
  happyCallStatus: z.enum(['COMPLETED', 'UNREACHABLE', 'RESCHEDULED']).optional(),
  happyCallOutcome: z.string().optional(),
  customerSatisfaction: z.number().min(1).max(5).optional(),
  customerRemarks: z.string().optional(),
  reopenRequested: z.boolean().default(false),
  escalationRequired: z.boolean().default(false),
  nextFollowUpDate: z.coerce.date().optional(),
});

export const CALL_DETAILS_SCHEMAS = {
  INITIAL: initialDetailsSchema,
  REQUIREMENT: requirementDetailsSchema,
  PRE_SERVICE: preServiceDetailsSchema,
  VISIT_UPDATE: visitUpdateDetailsSchema,
  POST_SERVICE_FOLLOWUP: postServiceFollowupDetailsSchema,
  HAPPY_CALL: happyCallDetailsSchema,
} as const;

export const createCallSchema = z
  .object({
    callType: z.enum(CALL_TYPES),
    direction: z.enum(CALL_DIRECTIONS),
    customerId: z.string().optional(),
    customerProductId: z.string().optional(),
    relatedLeadId: z.string().optional(),
    relatedServiceRequestId: z.string().optional(),
    callerNumber: z.string().min(10),
    alternateNumber: z.string().optional(),
    customerName: z.string().optional(),
    callDate: z.coerce.date(),
    callTime: z.string(),
    source: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    notes: z.string().optional(),
    attachments: z.array(z.string()).default([]),
    recordingUrl: z.string().optional(),
    branchId: z.string().optional(),
    assignedTo: z.string().optional(),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((data, ctx) => {
    const schema = CALL_DETAILS_SCHEMAS[data.callType];
    const result = schema.safeParse(data.details);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['details', ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export const updateCallSchema = z.object({
  outcome: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const listCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  callType: z.enum(CALL_TYPES).optional(),
  direction: z.enum(CALL_DIRECTIONS).optional(),
  customerId: z.string().optional(),
  createdBy: z.string().optional(),
  q: z.string().optional(),
});
