import { UserModel } from './users.model';
import { RolePermissionModel } from '../config/rolePermissions.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { hashPassword } from '../auth/auth.service';
import { SessionModel } from '../auth/sessions.model';
import { ROLES, Role, UserStatus } from './users.types';

function humanizeRole(role: Role): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Roles themselves are a fixed enum (users.types.ts), not a DB collection —
// this lists that enum with each role's real permission grants aggregated
// from RolePermissionModel (the actual RBAC seed), rather than a hardcoded
// permission list that could drift from what's actually enforced.
export async function listRoles() {
  const grants = await RolePermissionModel.find().lean();
  const permissionsByRole = new Map<string, string[]>();
  for (const g of grants) {
    const key = `${g.module}.${g.action}`;
    const list = permissionsByRole.get(g.role) ?? [];
    list.push(key);
    permissionsByRole.set(g.role, list);
  }

  return ROLES.map((role) => ({
    id: role,
    name: humanizeRole(role),
    description: '',
    permissions: permissionsByRole.get(role) ?? [],
  }));
}

interface ListParams {
  page: number;
  limit: number;
  role?: Role;
  branchId?: string;
  status?: UserStatus;
  q?: string;
}

export async function listUsers(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.role) filter.role = params.role;
  if (params.branchId) filter.branchId = params.branchId;
  if (params.status) filter.status = params.status;
  if (params.q) {
    filter.$or = [
      { name: { $regex: params.q, $options: 'i' } },
      { mobile: { $regex: params.q, $options: 'i' } },
      { email: { $regex: params.q, $options: 'i' } },
    ];
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    UserModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    UserModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getUser(id: string) {
  const user = await UserModel.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function createUser(data: {
  name: string;
  email?: string;
  mobile: string;
  password: string;
  role: Role;
  branchId?: string;
  subBranchId?: string;
  teamId?: string;
  vendorId?: string;
}) {
  const existing = await UserModel.findOne({ mobile: data.mobile });
  if (existing) throw new ConflictError('A user with this mobile number already exists', 'DUPLICATE_RECORD');

  const passwordHash = await hashPassword(data.password);
  return UserModel.create({
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    passwordHash,
    role: data.role,
    branchId: data.branchId,
    subBranchId: data.subBranchId,
    teamId: data.teamId,
    vendorId: data.vendorId,
  });
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const user = await UserModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!user) throw new NotFoundError('User not found');

  // Deactivating a user revokes all their active sessions immediately.
  if (data.status === 'INACTIVE') {
    await SessionModel.updateMany({ userId: id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  }

  return user;
}
