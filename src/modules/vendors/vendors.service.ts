import { VendorModel, VendorTechnicianModel } from './vendors.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';

interface ListParams {
  page: number;
  limit: number;
  pinCode?: string;
  active?: boolean;
  blacklisted?: boolean;
  q?: string;
}

export async function listVendors(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.pinCode) filter['serviceAreas.pinCodes'] = params.pinCode;
  if (params.active !== undefined) filter.active = params.active;
  if (params.blacklisted !== undefined) filter.blacklisted = params.blacklisted;
  if (params.q) filter.companyName = { $regex: params.q, $options: 'i' };

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    VendorModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    VendorModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getVendor(id: string) {
  const vendor = await VendorModel.findById(id);
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

export async function createVendor(data: Record<string, unknown>) {
  return VendorModel.create(data);
}

export async function updateVendor(id: string, data: Record<string, unknown>) {
  const vendor = await VendorModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

export async function deleteVendor(id: string) {
  const vendor = await VendorModel.findByIdAndDelete(id);
  if (!vendor) throw new NotFoundError('Vendor not found');
}

export async function setBlacklistStatus(id: string, blacklisted: boolean, reason?: string) {
  const vendor = await VendorModel.findByIdAndUpdate(
    id,
    { blacklisted, blacklistReason: blacklisted ? reason : undefined },
    { new: true }
  );
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

export async function listVendorTechnicians(vendorId: string) {
  return VendorTechnicianModel.find({ vendorId }).populate('userId', 'name mobile email');
}

export async function createVendorTechnician(data: Record<string, unknown>) {
  return VendorTechnicianModel.create(data);
}
