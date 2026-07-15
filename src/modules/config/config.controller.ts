import { Response, NextFunction } from 'express';
import * as configService from './config.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { MasterType } from './master.model';

export async function listMastersHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const masterType = req.params.masterType as MasterType;
    const { items, meta } = await configService.listMasters(masterType, req.query as never);
    sendSuccess(res, items, 'Masters fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function createMasterHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const masterType = req.params.masterType as MasterType;
    const master = await configService.createMaster(masterType, req.body);
    sendSuccess(res, master, 'Master entry created successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateMasterHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const masterType = req.params.masterType as MasterType;
    const master = await configService.updateMaster(masterType, paramAsString(req.params.id), req.body);
    sendSuccess(res, master, 'Master entry updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteMasterHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const masterType = req.params.masterType as MasterType;
    await configService.deleteMaster(masterType, paramAsString(req.params.id));
    sendSuccess(res, null, 'Master entry deactivated successfully');
  } catch (err) {
    next(err);
  }
}
