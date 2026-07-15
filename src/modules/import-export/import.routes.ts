import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { requireEntityPermission } from './dynamicPermission';
import { importEntityParamSchema, importQuerySchema } from './import.validation';
import * as ctrl from './import.controller';

// Import files are small (a few thousand spreadsheet rows) — buffered in
// memory rather than written to disk first, same rationale as files.routes.ts's upload adapter.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// docs/15-excel-import-export-specification.md §2: POST /import/{entity}
// (multipart), ?dryRun=true, ?mode=partial|strict. Permission key `{entity}.import.{scope}`.
router.post(
  '/import/:entity',
  authMiddleware,
  validate(importEntityParamSchema, 'params'),
  requireEntityPermission('import'),
  validate(importQuerySchema, 'query'),
  upload.single('file'),
  ctrl.importEntityHandler
);

export default router;
