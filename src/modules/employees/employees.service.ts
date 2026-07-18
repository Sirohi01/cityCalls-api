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

export async function createEmployee(data: Record<string, unknown>) {
  return EmployeeModel.create(data);
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  const employee = await EmployeeModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!employee) throw new NotFoundError('Employee not found');
  return employee;
}
