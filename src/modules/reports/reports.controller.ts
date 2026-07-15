import { Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function runReportHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const reportKey = paramAsString(req.params.reportKey);
    const query = req.query as { branchId?: string; dateFrom?: Date; dateTo?: Date };
    const data = await reportsService.runReport(reportKey, req.scope, req.user, query);
    sendSuccess(res, data, 'Report generated successfully');
  } catch (err) {
    next(err);
  }
}
