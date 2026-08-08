import { VendorModel, VendorTechnicianModel } from './vendors.model';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { AccessTokenPayload } from '../../lib/jwt';
import { DataScope } from '../users/users.types';

interface ListParams {
  page: number;
  limit: number;
  pinCode?: string;
  active?: boolean;
  blacklisted?: boolean;
  q?: string;
}

export async function listVendors(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  const filter: Record<string, unknown> = {};
  if (params.pinCode) filter['serviceAreas.pinCodes'] = params.pinCode;
  if (params.active !== undefined) filter.active = params.active;
  if (params.blacklisted !== undefined) filter.blacklisted = params.blacklisted;
  if (params.q) filter.companyName = { $regex: params.q, $options: 'i' };
  // VENDOR_OWNER/VENDOR_MANAGER (dataScope 'VENDOR') only ever see their own
  // company, never the full vendor directory.
  if (scope === 'VENDOR') filter._id = user.vendorId ?? null;

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    VendorModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    VendorModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

// Same shape as employees.service.ts's assertEmployeeAccessInScope — a
// VENDOR_OWNER/VENDOR_MANAGER may only touch their own vendor record.
export async function assertVendorAccessInScope(vendorId: string, scope: DataScope, user: AccessTokenPayload): Promise<void> {
  if (scope === 'ALL') return;
  if (scope === 'VENDOR') {
    if (!user.vendorId || user.vendorId !== vendorId) throw new NotFoundError('Vendor not found');
    return;
  }
  throw new ForbiddenError(`Role ${user.role} is not permitted to access vendor records`);
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

// Vendor-mobile's own-profile screen for VENDOR_TECHNICIAN — mirrors
// employees.service.ts's getOwnEmployee, since a vendor technician has no
// Employee record at all (they're a VendorTechnician instead).
export async function getOwnVendorTechnician(userId: string) {
  const technician = await VendorTechnicianModel.findOne({ userId })
    .populate('userId', 'name mobile email')
    .populate('vendorId', 'companyName');
  if (!technician) throw new NotFoundError('No vendor technician record linked to this account');
  return technician;
}

export async function createVendorTechnician(data: Record<string, unknown>) {
  return VendorTechnicianModel.create(data);
}
