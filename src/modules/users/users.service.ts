import { UserModel } from './users.model';
import { RolePermissionModel } from '../config/rolePermissions.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { hashPassword } from '../auth/auth.service';
import { SessionModel } from '../auth/sessions.model';
import { ROLES, Role, UserStatus, DataScope } from './users.types';
import { loadPermissionCache } from '../../lib/permissionCache';
import { logActivity } from '../../lib/auditLog';
import { AccessTokenPayload } from '../../lib/jwt';

function humanizeRole(role: Role): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

interface PermissionActorOut {
  id: string;
  name: string;
}

interface PermissionRowOut {
  id: string;
  module: string;
  action: string;
  dataScope: DataScope;
  createdBy: PermissionActorOut | null;
  createdAt: Date | null;
  updatedBy: PermissionActorOut | null;
  updatedAt: Date | null;
}

// Roles themselves are a fixed enum (users.types.ts), not a DB collection —
// this lists that enum with each role's real permission grants aggregated
// from RolePermissionModel (the actual RBAC seed / runtime edits), rather
// than a hardcoded permission list that could drift from what's enforced.
// `editable: false` on SUPER_ADMIN — its own grants are protected from the
// runtime editor (already has ALL scope everywhere; editing/deleting these
// risks locking every admin out of the system).
export async function listRoles() {
  const grants = await RolePermissionModel.find()
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .sort({ module: 1, action: 1 })
    .lean();

  const permissionsByRole = new Map<string, PermissionRowOut[]>();
  for (const g of grants) {
    const createdBy = g.createdBy as unknown as { _id: { toString(): string }; name: string } | null;
    const updatedBy = g.updatedBy as unknown as { _id: { toString(): string }; name: string } | null;
    const list = permissionsByRole.get(g.role) ?? [];
    list.push({
      id: g._id.toString(),
      module: g.module,
      action: g.action,
      dataScope: g.dataScope,
      createdBy: createdBy ? { id: createdBy._id.toString(), name: createdBy.name } : null,
      createdAt: g.createdAt ?? null,
      updatedBy: updatedBy ? { id: updatedBy._id.toString(), name: updatedBy.name } : null,
      updatedAt: g.updatedAt ?? null,
    });
    permissionsByRole.set(g.role, list);
  }

  return ROLES.map((role) => ({
    id: role,
    name: humanizeRole(role),
    description: '',
    editable: role !== 'SUPER_ADMIN',
    permissions: permissionsByRole.get(role) ?? [],
  }));
}

export async function createRolePermission(
  role: Role,
  data: { module: string; action: string; dataScope: DataScope },
  actor: AccessTokenPayload
) {
  if (role === 'SUPER_ADMIN') {
    throw new ConflictError('Super Admin permissions cannot be modified', 'SUPER_ADMIN_PROTECTED');
  }
  const existing = await RolePermissionModel.findOne({ role, module: data.module, action: data.action });
  if (existing) throw new ConflictError('This role already has a grant for that module/action', 'DUPLICATE_RECORD');

  const created = await RolePermissionModel.create({ ...data, role, createdBy: actor.sub });
  await loadPermissionCache();
  await logActivity({
    entityType: 'ROLE_PERMISSION',
    entityId: created._id.toString(),
    user: actor,
    action: 'CREATED',
    module: 'users',
    newValue: { role, module: data.module, action: data.action, dataScope: data.dataScope },
  });
  return created.populate('createdBy', 'name');
}

export async function updateRolePermission(id: string, dataScope: DataScope, actor: AccessTokenPayload) {
  const existing = await RolePermissionModel.findById(id);
  if (!existing) throw new NotFoundError('Permission not found');
  if (existing.role === 'SUPER_ADMIN') {
    throw new ConflictError('Super Admin permissions cannot be modified', 'SUPER_ADMIN_PROTECTED');
  }

  const fromScope = existing.dataScope;
  existing.dataScope = dataScope;
  existing.updatedBy = actor.sub as never;
  await existing.save();
  await loadPermissionCache();
  await logActivity({
    entityType: 'ROLE_PERMISSION',
    entityId: id,
    user: actor,
    action: 'UPDATED',
    module: 'users',
    oldValue: { dataScope: fromScope },
    newValue: { dataScope },
  });
  return existing.populate([
    { path: 'createdBy', select: 'name' },
    { path: 'updatedBy', select: 'name' },
  ]);
}

export async function deleteRolePermission(id: string, actor: AccessTokenPayload) {
  const existing = await RolePermissionModel.findById(id);
  if (!existing) throw new NotFoundError('Permission not found');
  if (existing.role === 'SUPER_ADMIN') {
    throw new ConflictError('Super Admin permissions cannot be modified', 'SUPER_ADMIN_PROTECTED');
  }

  await existing.deleteOne();
  await loadPermissionCache();
  await logActivity({
    entityType: 'ROLE_PERMISSION',
    entityId: id,
    user: actor,
    action: 'DELETED',
    module: 'users',
    oldValue: { role: existing.role, module: existing.module, action: existing.action, dataScope: existing.dataScope },
  });
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
    UserModel.find(filter)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .skip(skip)
      .limit(params.limit)
      .sort({ createdAt: -1 }),
    UserModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getUser(id: string) {
  const user = await UserModel.findById(id).populate('createdBy', 'name').populate('updatedBy', 'name');
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function createUser(
  data: {
    name: string;
    email?: string;
    mobile: string;
    password: string;
    role: Role;
    branchId?: string;
    subBranchId?: string;
    teamId?: string;
    vendorId?: string;
  },
  actorId: string
) {
  const existing = await UserModel.findOne({ mobile: data.mobile });
  if (existing) throw new ConflictError('A user with this mobile number already exists', 'DUPLICATE_RECORD');

  const passwordHash = await hashPassword(data.password);
  const created = await UserModel.create({
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    passwordHash,
    role: data.role,
    branchId: data.branchId,
    subBranchId: data.subBranchId,
    teamId: data.teamId,
    vendorId: data.vendorId,
    createdBy: actorId,
  });
  return created.populate('createdBy', 'name');
}

export async function updateUser(id: string, data: Record<string, unknown>, actorId: string) {
  const user = await UserModel.findByIdAndUpdate(
    id,
    { ...data, updatedBy: actorId },
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');
  if (!user) throw new NotFoundError('User not found');

  // Deactivating a user revokes all their active sessions immediately.
  if (data.status === 'INACTIVE') {
    await SessionModel.updateMany({ userId: id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  }

  return user;
}
