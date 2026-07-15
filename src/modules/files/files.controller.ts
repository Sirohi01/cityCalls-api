import { Response, NextFunction } from 'express';
import * as filesService from './files.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import { FileCategory } from './files.model';

export async function signedUploadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const result = filesService.requestSignedUpload(req.body);
    sendSuccess(res, result, 'Signed upload parameters generated successfully');
  } catch (err) {
    next(err);
  }
}

export async function confirmUploadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const file = await filesService.confirmUpload(req.body, req.user);
    sendSuccess(res, file, 'Upload confirmed successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

// multipart/form-data direct upload — the local-fallback counterpart to the
// signed-upload + confirm pair, per docs/lib/fileStorage.ts's documented gap
// (no S3-compatible store available in this environment).
export async function directUploadHandler(req: ScopedRequest & { file?: Express.Multer.File }, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) {
      throw new ValidationError([{ field: 'file', code: 'REQUIRED_FIELD_MISSING', message: 'No file was uploaded' }]);
    }
    const { category, entityType, entityId } = req.body as { category: FileCategory; entityType: string; entityId: string };
    const file = await filesService.uploadLocal(
      {
        category,
        entityType,
        entityId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      },
      req.user
    );
    sendSuccess(res, file, 'File uploaded successfully', null, 201);
  } catch (err) {
    next(err);
  }
}

export async function getFileHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const file = await filesService.getFile(paramAsString(req.params.id));
    sendSuccess(res, file, 'File fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteFileHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    await filesService.deleteFile(paramAsString(req.params.id), req.user);
    sendSuccess(res, null, 'File deleted successfully');
  } catch (err) {
    next(err);
  }
}
