import { MasterModel, MasterType } from './master.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';

interface ListParams {
  page: number;
  limit: number;
  active?: boolean;
  parentId?: string;
}

export async function listMasters(masterType: MasterType, params: ListParams) {
  const filter: Record<string, unknown> = { masterType };
  if (params.active !== undefined) filter.active = params.active;
  if (params.parentId) filter.parentId = params.parentId;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    MasterModel.find(filter).sort({ sortOrder: 1, label: 1 }).skip(skip).limit(params.limit),
    MasterModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function createMaster(masterType: MasterType, data: Record<string, unknown>) {
  return MasterModel.create({ ...data, masterType });
}

export async function updateMaster(masterType: MasterType, id: string, data: Record<string, unknown>) {
  const master = await MasterModel.findOneAndUpdate({ _id: id, masterType }, data, {
    new: true,
    runValidators: true,
  });
  if (!master) throw new NotFoundError('Master entry not found');
  return master;
}

export async function deleteMaster(masterType: MasterType, id: string) {
  const master = await MasterModel.findOneAndUpdate(
    { _id: id, masterType },
    { active: false },
    { new: true }
  );
  if (!master) throw new NotFoundError('Master entry not found');
  return master;
}
