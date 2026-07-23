import { ServiceModel } from './catalog.model';
import { BranchModel } from '../organization/organization.model';
import { MasterModel } from '../config/master.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { resolveVerticalCategoryIds } from '../../lib/verticals';

// Brands ride on the generic Masters engine (masterType: 'BRAND'), same as
// every other master list — this just gives the admin UI's brand-management
// screen a friendlier response shape than the raw generic /masters/BRAND one.
export async function listBrands() {
  const brands = await MasterModel.find({ masterType: 'BRAND' }).sort({ sortOrder: 1, label: 1 }).lean();
  return brands.map((b) => ({
    id: b._id.toString(),
    key: b.key,
    name: b.label,
    status: b.active ? 'Active' : 'Inactive',
  }));
}

interface ListParams {
  page: number;
  limit: number;
  active?: boolean;
  categoryId?: string;
  productTypeId?: string;
  q?: string;
  vertical?: string;
}

export async function listServices(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.active !== undefined) filter.active = params.active;
  if (params.categoryId) filter.categoryId = params.categoryId;
  if (params.productTypeId) filter.applicableProductTypeIds = params.productTypeId;
  if (params.q) filter.name = { $regex: params.q, $options: 'i' };
  if (params.vertical) filter.categoryId = { $in: await resolveVerticalCategoryIds(params.vertical) };

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    ServiceModel.find(filter).skip(skip).limit(params.limit).sort({ name: 1 }),
    ServiceModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getService(id: string) {
  const service = await ServiceModel.findById(id);
  if (!service) throw new NotFoundError('Service not found');
  return service;
}

export async function createService(data: Record<string, unknown>) {
  return ServiceModel.create(data);
}

export async function updateService(id: string, data: Record<string, unknown>) {
  const service = await ServiceModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!service) throw new NotFoundError('Service not found');
  return service;
}

export async function deleteService(id: string) {
  const service = await ServiceModel.findByIdAndDelete(id);
  if (!service) throw new NotFoundError('Service not found');
}

// Per docs/06-complete-workflow-document.md Stage 1: check pin-code coverage
// before allowing the customer app to progress past service selection.
export async function checkCoverage(serviceId: string, pinCode: string) {
  const service = await ServiceModel.findById(serviceId);
  if (!service || !service.active) {
    return { serviceable: false, reason: 'SERVICE_NOT_ACTIVE' };
  }

  const branch = await BranchModel.findOne({
    active: true,
    'coverage.pinCodes': pinCode,
    serviceCategoryIds: service.categoryId,
  }).select('_id name code');

  if (!branch) {
    return { serviceable: false, reason: 'PIN_CODE_NOT_SERVICEABLE' };
  }

  return { serviceable: true, branchId: branch._id, branchName: branch.name };
}
