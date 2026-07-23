import { BranchModel, SubBranchModel, TeamModel } from './organization.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';

interface ListParams {
  page: number;
  limit: number;
  active?: boolean;
  q?: string;
}

// Branch/SubBranch/Team scoping is bespoke per entity (not the generic
// applyScopeFilter helper) because "my own branch/sub-branch" means filtering
// by _id here, not by a branchId/subBranchId field the way it does on
// operational records like Leads or Calls.
export async function listBranches(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (params.active !== undefined) filter.active = params.active;
  if (params.q) filter.name = { $regex: params.q, $options: 'i' };
  if ((scope === 'BRANCH' || scope === 'SUB_BRANCH') && user.branchId) filter._id = user.branchId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    BranchModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    BranchModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getBranch(id: string) {
  const branch = await BranchModel.findById(id);
  if (!branch) throw new NotFoundError('Branch not found');
  return branch;
}

export async function createBranch(data: Record<string, unknown>) {
  return BranchModel.create(data);
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  const branch = await BranchModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!branch) throw new NotFoundError('Branch not found');
  return branch;
}

export async function deleteBranch(id: string) {
  const branch = await BranchModel.findByIdAndDelete(id);
  if (!branch) throw new NotFoundError('Branch not found');
}

export async function listSubBranches(branchId: string | undefined, params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (branchId) filter.branchId = branchId;
  if (params.active !== undefined) filter.active = params.active;
  // A scoped caller's own branch/sub-branch always wins over the client-
  // supplied branchId filter above — never let a narrower-scoped user widen
  // their view by passing a different branchId.
  if (scope === 'BRANCH' && user.branchId) filter.branchId = user.branchId;
  if (scope === 'SUB_BRANCH' && user.subBranchId) filter._id = user.subBranchId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    SubBranchModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    SubBranchModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function createSubBranch(data: Record<string, unknown>) {
  return SubBranchModel.create(data);
}

export async function updateSubBranch(id: string, data: Record<string, unknown>) {
  const subBranch = await SubBranchModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!subBranch) throw new NotFoundError('Sub-branch not found');
  return subBranch;
}

export async function deleteSubBranch(id: string) {
  const subBranch = await SubBranchModel.findByIdAndDelete(id);
  if (!subBranch) throw new NotFoundError('Sub-branch not found');
}

export async function listTeams(branchId: string | undefined, params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (branchId) filter.branchId = branchId;
  if (params.active !== undefined) filter.active = params.active;
  if (scope === 'BRANCH' && user.branchId) filter.branchId = user.branchId;
  if (scope === 'SUB_BRANCH' && user.subBranchId) filter.subBranchId = user.subBranchId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    TeamModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    TeamModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function createTeam(data: Record<string, unknown>) {
  return TeamModel.create(data);
}

export async function updateTeam(id: string, data: Record<string, unknown>) {
  const team = await TeamModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

export async function deleteTeam(id: string) {
  const team = await TeamModel.findByIdAndDelete(id);
  if (!team) throw new NotFoundError('Team not found');
}
