import { Response, NextFunction } from 'express';
import * as vendorService from './vendors.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function listVendorsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await vendorService.listVendors(req.query as never);
    sendSuccess(res, items, 'Vendors fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getVendorHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.getVendor(paramAsString(req.params.id));
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
    const vendor = await vendorService.updateVendor(paramAsString(req.params.id), req.body);
    sendSuccess(res, vendor, 'Vendor updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function setBlacklistHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { blacklisted, blacklistReason } = req.body as { blacklisted: boolean; blacklistReason?: string };
    const vendor = await vendorService.setBlacklistStatus(paramAsString(req.params.id), blacklisted, blacklistReason);
    sendSuccess(res, vendor, 'Vendor blacklist status updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function listVendorTechniciansHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const technicians = await vendorService.listVendorTechnicians(paramAsString(req.params.id));
    sendSuccess(res, technicians, 'Vendor technicians fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createVendorTechnicianHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const technician = await vendorService.createVendorTechnician({
      ...req.body,
      vendorId: paramAsString(req.params.id),
    });
    sendSuccess(res, technician, 'Vendor technician added successfully', null, 201);
  } catch (err) {
    next(err);
  }
}
