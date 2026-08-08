import { Response, NextFunction } from 'express';
import * as vendorService from './vendors.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, ForbiddenError } from '../../lib/errors';

// Blacklisting/deleting a vendor is an administrative action a vendor must
// never be able to direct at itself, regardless of scope match — distinct
// from updateVendor (editing your own profile/bank details), which is
// legitimate self-service VENDOR_OWNER/VENDOR_MANAGER already have 'edit' for.
function assertAdminOnly(req: ScopedRequest): void {
  if (!req.scope || req.scope !== 'ALL') {
    throw new ForbiddenError('Only platform admins can perform this action');
  }
}

export async function getOwnVendorTechnicianHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const technician = await vendorService.getOwnVendorTechnician(req.user.sub);
    sendSuccess(res, technician, 'Vendor technician profile fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function listVendorsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const { items, meta } = await vendorService.listVendors(req.query as never, req.scope, req.user);
    sendSuccess(res, items, 'Vendors fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getVendorHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await vendorService.assertVendorAccessInScope(id, req.scope, req.user);
    const vendor = await vendorService.getVendor(id);
    sendSuccess(res, vendor, 'Vendor fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createVendorHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.createVendor(req.body);
    sendSuccess(res, vendor, 'Vendor created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateVendorHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await vendorService.assertVendorAccessInScope(id, req.scope, req.user);
    const vendor = await vendorService.updateVendor(id, req.body);
    sendSuccess(res, vendor, 'Vendor updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function setBlacklistHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    assertAdminOnly(req);
    const { blacklisted, blacklistReason } = req.body as { blacklisted: boolean; blacklistReason?: string };
    const vendor = await vendorService.setBlacklistStatus(paramAsString(req.params.id), blacklisted, blacklistReason);
    sendSuccess(res, vendor, 'Vendor blacklist status updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteVendorHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    assertAdminOnly(req);
    await vendorService.deleteVendor(paramAsString(req.params.id));
    sendSuccess(res, null, 'Vendor deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function listVendorTechniciansHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await vendorService.assertVendorAccessInScope(id, req.scope, req.user);
    const technicians = await vendorService.listVendorTechnicians(id);
    sendSuccess(res, technicians, 'Vendor technicians fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createVendorTechnicianHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const id = paramAsString(req.params.id);
    await vendorService.assertVendorAccessInScope(id, req.scope, req.user);
    const technician = await vendorService.createVendorTechnician({
      ...req.body,
      vendorId: id,
    });
    sendSuccess(res, technician, 'Vendor technician added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}
