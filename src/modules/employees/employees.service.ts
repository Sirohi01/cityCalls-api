import { EmployeeModel } from './employees.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { applyScopeFilter } from '../../lib/scopeFilter';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';

interface ListParams {
  page: number;
  limit: number;
  branchId?: string;
  skill?: string;
  active?: boolean;
}

export async function listEmployees(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  let filter: Record<string, unknown> = {};
  if (params.branchId) filter.branchId = params.branchId;
  if (params.skill) filter.skills = params.skill;
  if (params.active !== undefined) filter.active = params.active;
  filter = applyScopeFilter(filter, scope, user);

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    EmployeeModel.find(filter).populate('userId', 'name mobile email').skip(skip).limit(params.limit),
    EmployeeModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getEmployee(id: string) {
  const employee = await EmployeeModel.findById(id).populate('userId', 'name mobile email');
  if (!employee) throw new NotFoundError('Employee not found');
  return employee;
}
export async function getOwnEmployee(userId: string) {
  const employee = await EmployeeModel.findOne({ userId })
    .populate('userId', 'name mobile email')
    .populate('branchId', 'name code')
    .populate('subBranchId', 'name')
    .populate('teamId', 'name');
  if (!employee) throw new NotFoundError('No employee record linked to this account');
  return employee;
}
export async function registerFcmToken(userId: string, token: string) {
  const employee = await EmployeeModel.findOneAndUpdate({ userId }, { $addToSet: { fcmTokens: token } }, { new: true });
  if (!employee) throw new NotFoundError('No employee record linked to this account');
  return employee;
}

export async function unregisterFcmToken(userId: string, token: string) {
  const employee = await EmployeeModel.findOneAndUpdate({ userId }, { $pull: { fcmTokens: token } }, { new: true });
  if (!employee) throw new NotFoundError('No employee record linked to this account');
  return employee;
}

export async function createEmployee(data: Record<string, unknown>) {
  return EmployeeModel.create(data);
}

// Per docs/rohit/06-vendor-app-screen-list.md "Profile" — Availability
// toggle. Keyed by userId like getOwnEmployee — narrow, self-service only
// (see updateAvailabilitySchema for why this isn't just updateEmployee()).
export async function updateOwnAvailability(userId: string, availability: { day: number; available: boolean }[]) {
  const employee = await EmployeeModel.findOneAndUpdate({ userId }, { availability }, { new: true, runValidators: true })
    .populate('userId', 'name mobile email')
    .populate('branchId', 'name code')
    .populate('subBranchId', 'name')
    .populate('teamId', 'name');
  if (!employee) throw new NotFoundError('No employee record linked to this account');
  return employee;
}
export async function assertEmployeeAccessInScope(employee: { userId: unknown; branchId: unknown }, scope: DataScope, user: AccessTokenPayload): Promise<void> {
  if (scope === 'ALL') return;
  if (scope === 'OWN') {
    const ownerUserId = (employee.userId as { toString(): string } | undefined)?.toString();
    if (ownerUserId !== user.sub) throw new NotFoundError('Employee not found');
    return;
  }
  if (scope === 'BRANCH') {
    const employeeBranchId = (employee.branchId as { toString(): string } | undefined)?.toString();
    if (!user.branchId || employeeBranchId !== user.branchId) throw new NotFoundError('Employee not found');
    return;
  }
  throw new NotFoundError('Employee not found');
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  const employee = await EmployeeModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!employee) throw new NotFoundError('Employee not found');
  return employee;
}

export async function deleteEmployee(id: string) {
  const employee = await EmployeeModel.findByIdAndDelete(id);
  if (!employee) throw new NotFoundError('Employee not found');
}
