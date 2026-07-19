import { z } from 'zod';

export const workingHoursSchema = z.object({
  day: z.number().min(0).max(6),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  closed: z.boolean().default(false),
});

const registeredAddressSchema = z.object({
  line1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(4),
});

export const createBranchSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  coverage: z
    .object({
      pinCodes: z.array(z.string()).default([]),
      cities: z.array(z.string()).default([]),
      states: z.array(z.string()).default([]),
    })
    .default({ pinCodes: [], cities: [], states: [] }),
  serviceCategoryIds: z.array(z.string()).default([]),
  workingHours: z.array(workingHoursSchema).default([]),
  managerId: z.string().optional(),
  registeredAddress: registeredAddressSchema.optional(),
  gstin: z.string().optional(),
  holidays: z.array(z.coerce.date()).default([]),
  active: z.boolean().optional(),
});

// Explicit (not createBranchSchema.partial()) — see updateCustomerSchema
// in customers.validation.ts for why: .partial() over .default()-bearing
// fields still applies the default on an omitted key, which would wipe
// coverage/serviceCategoryIds/workingHours/holidays to empty on any
// partial PATCH that didn't resend them all.
export const updateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).optional(),
  coverage: z
    .object({
      pinCodes: z.array(z.string()).default([]),
      cities: z.array(z.string()).default([]),
      states: z.array(z.string()).default([]),
    })
    .optional(),
  serviceCategoryIds: z.array(z.string()).optional(),
  workingHours: z.array(workingHoursSchema).optional(),
  managerId: z.string().optional(),
  registeredAddress: registeredAddressSchema.optional(),
  gstin: z.string().optional(),
  holidays: z.array(z.coerce.date()).optional(),
  active: z.boolean().optional(),
});

export const createSubBranchSchema = z.object({
  branchId: z.string(),
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  coverage: z.object({ pinCodes: z.array(z.string()).default([]) }).default({ pinCodes: [] }),
  managerId: z.string().optional(),
  active: z.boolean().optional(),
});

// Explicit (not createSubBranchSchema.partial()) — same defaults-under-
// partial() footgun as updateBranchSchema above.
export const updateSubBranchSchema = z.object({
  branchId: z.string().optional(),
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).optional(),
  coverage: z.object({ pinCodes: z.array(z.string()).default([]) }).optional(),
  managerId: z.string().optional(),
  active: z.boolean().optional(),
});

export const createTeamSchema = z.object({
  branchId: z.string(),
  subBranchId: z.string().optional(),
  name: z.string().min(2),
  leadId: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
});

// Explicit (not createTeamSchema.partial()) — same defaults-under-
// partial() footgun as updateBranchSchema above (memberIds would wipe
// to [] on any partial PATCH that didn't resend it).
export const updateTeamSchema = z.object({
  branchId: z.string().optional(),
  subBranchId: z.string().optional(),
  name: z.string().min(2).optional(),
  leadId: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().optional(),
  q: z.string().optional(),
  branchId: z.string().optional(),
});
