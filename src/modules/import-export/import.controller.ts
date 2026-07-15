import { Response, NextFunction } from 'express';
import * as importService from './import.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { ValidationError, UnauthorizedError } from '../../lib/errors';

interface MulterRequest extends ScopedRequest {
  file?: Express.Multer.File;
}

export async function importEntityHandler(req: MulterRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) {
      throw new ValidationError([{ field: 'file', code: 'REQUIRED', message: 'A file upload is required' }]);
    }
    // .xlsx import is not supported — see the comment on parseCsv in
    // lib/exportBuilder.ts for why (the xlsx package's parser has unpatched
    // high-severity advisories; export still supports xlsx, since that path
    // only ever serializes trusted internal data, never parses uploads).
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      throw new ValidationError([
        { field: 'file', code: 'UNSUPPORTED_FORMAT', message: 'Only .csv files are supported for import (not .xlsx)' },
      ]);
    }
    const entity = paramAsString(req.params.entity);
    const { dryRun, mode } = req.query as unknown as { dryRun: boolean; mode: 'partial' | 'strict' };

    const result = await importService.importEntity(entity, req.file.buffer, { dryRun, mode });
    sendSuccess(res, result, dryRun ? 'Import validated (dry run)' : 'Import processed');
  } catch (err) {
    next(err);
  }
}
