import { z } from 'zod';

export const createEmployeeSchema = z.object({
  userId: z.string(),
  branchId: z.string(),
  subBranchId: z.string().optional(),
  teamId: z.string().optional(),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  dailyCapacity: z.number().default(5),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  skill: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
