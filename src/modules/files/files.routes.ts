import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { signedUploadSchema, confirmUploadSchema, uploadFormSchema, listFilesQuerySchema } from './files.validation';
import * as ctrl from './files.controller';

// In-memory storage — files are small enough (largest category cap is 100MB
// video) to buffer before writing to local disk or forwarding to Cloudinary;
// avoids a temp-file cleanup concern for a v1 fallback path.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

router.post('/files/signed-upload', authMiddleware, validate(signedUploadSchema), ctrl.signedUploadHandler);
router.post('/files/confirm', authMiddleware, validate(confirmUploadSchema), ctrl.confirmUploadHandler);
router.post('/files/upload', authMiddleware, upload.single('file'), validate(uploadFormSchema), ctrl.directUploadHandler);
router.get('/files', authMiddleware, validate(listFilesQuerySchema, 'query'), ctrl.listFilesHandler);
router.get('/files/:id', authMiddleware, ctrl.getFileHandler);
router.delete('/files/:id', authMiddleware, ctrl.deleteFileHandler);

export default router;
