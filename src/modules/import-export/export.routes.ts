import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { requireEntityPermission } from './dynamicPermission';
import { exportEntityParamSchema, exportQuerySchema } from './export.validation';
import * as ctrl from './export.controller';

const router = Router();

// docs/15-excel-import-export-specification.md §1: GET /export/{entity}?format=xlsx|csv,
// reusing the entity's list-endpoint filters. Permission key `{entity}.export.{scope}`.
router.get(
  '/export/:entity',
  authMiddleware,
  validate(exportEntityParamSchema, 'params'),
  requireEntityPermission('export'),
  validate(exportQuerySchema, 'query'),
  ctrl.exportEntityHandler
);

export default router;
