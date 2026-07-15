import { Response, NextFunction } from 'express';
import * as catalogService from './catalog.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { AppError } from '../../lib/errors';

export async function listServicesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await catalogService.listServices(req.query as never);
    sendSuccess(res, items, 'Services fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function getServiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const service = await catalogService.getService(paramAsString(req.params.id));
    sendSuccess(res, service, 'Service fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function createServiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const service = await catalogService.createService(req.body);
    sendSuccess(res, service, 'Service created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateServiceHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const service = await catalogService.updateService(paramAsString(req.params.id), req.body);
    sendSuccess(res, service, 'Service updated successfully');
  } catch (err) {
    next(err);
  }
}

// PIN_CODE_NOT_SERVICEABLE / SERVICE_NOT_ACTIVE are informational business
// outcomes, not errors — returned as 200 with a flag, per docs/18 §6.
export async function checkCoverageHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const pinCode = req.query.pinCode as string | undefined;
    if (!pinCode) throw new AppError(422, 'Validation failed', [{ field: 'pinCode', code: 'REQUIRED_FIELD_MISSING', message: 'pinCode is required' }]);
    const result = await catalogService.checkCoverage(paramAsString(req.params.id), pinCode);
    sendSuccess(res, result, 'Coverage checked successfully');
  } catch (err) {
    next(err);
  }
}
