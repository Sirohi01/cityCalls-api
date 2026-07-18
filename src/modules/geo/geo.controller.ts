import { Response, NextFunction } from 'express';
import * as geoService from './geo.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function checkAreaHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const result = await geoService.checkArea(paramAsString(req.params.pincode));
    sendSuccess(res, result, 'Area checked successfully');
  } catch (err) {
    next(err);
  }
}
