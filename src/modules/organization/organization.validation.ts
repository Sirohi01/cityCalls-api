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

export const updateBranchSchema = createBranchSchema.partial();

export const createSubBranchSchema = z.object({
  branchId: z.string(),
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  coverage: z.object({ pinCodes: z.array(z.string()).default([]) }).default({ pinCodes: [] }),
  managerId: z.string().optional(),
  active: z.boolean().optional(),
});

export const updateSubBranchSchema = createSubBranchSchema.partial();

export const createTeamSchema = z.object({
  branchId: z.string(),
  subBranchId: z.string().optional(),
  name: z.string().min(2),
  leadId: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
});

export const updateTeamSchema = createTeamSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().optional(),
  q: z.string().optional(),
  branchId: z.string().optional(),
});
