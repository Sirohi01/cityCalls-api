import { z } from 'zod';

export const createEmployeeSchema = z.object({
  userId: z.string(),
  branchId: z.string(),
  subBranchId: z.string().optional(),
  teamId: z.string().optional(),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  dailyCapacity: z.number().default(5),
  active: z.boolean().optional(),
});

// Explicit (not createEmployeeSchema.partial()) — see updateCustomerSchema
// in customers.validation.ts for why: .partial() over .default()-bearing
// fields still applies the default on an omitted key, which would wipe
// skills/certifications and reset dailyCapacity to 5 on any partial PATCH.
export const updateEmployeeSchema = z.object({
  userId: z.string().optional(),
  branchId: z.string().optional(),
  subBranchId: z.string().optional(),
  teamId: z.string().optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  dailyCapacity: z.number().optional(),
  active: z.boolean().optional(),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  skill: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
