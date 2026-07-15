import { Response, NextFunction } from 'express';
import * as exportService from './export.service';
import { paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function exportEntityHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.scope) throw new UnauthorizedError();
    const entity = paramAsString(req.params.entity);
    const { format, columns } = req.query as { format: 'csv' | 'xlsx'; columns?: string };
    const columnList = columns ? columns.split(',').map((c) => c.trim()) : undefined;

    const result = await exportService.exportEntity(entity, format, req.scope, req.user, req.query as Record<string, string>, columnList);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.body);
  } catch (err) {
    next(err);
  }
}
