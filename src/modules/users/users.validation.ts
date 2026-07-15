import { z } from 'zod';
import { ROLES } from './users.types';

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  mobile: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES),
  branchId: z.string().optional(),
  subBranchId: z.string().optional(),
  teamId: z.string().optional(),
  vendorId: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  branchId: z.string().optional(),
  subBranchId: z.string().optional(),
  teamId: z.string().optional(),
  vendorId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
  branchId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  q: z.string().optional(),
});
