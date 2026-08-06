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

export const fcmTokenSchema = z.object({
  token: z.string().min(1),
});

// Deliberately narrow (only `availability`) rather than reusing
// updateEmployeeSchema — a technician self-service toggle must not be able
// to also change their own branchId/skills/dailyCapacity/active just because
// they hold 'edit'+OWN on the employees module (that grant exists only so
// PATCH /employees/me/fcm-token and this endpoint work).
export const updateAvailabilitySchema = z.object({
  availability: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      available: z.boolean(),
    })
  ),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  skill: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
