import { Response, NextFunction } from 'express';
import * as auditService from './audit.service';
import { sendSuccess } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function listAuditLogsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { items, meta } = await auditService.listAuditLogs(req.query as never);
    sendSuccess(res, items, 'Audit logs retrieved', meta);
  } catch (error) {
    next(error);
  }
}
