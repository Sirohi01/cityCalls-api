import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { reportKeyParamSchema, reportQuerySchema } from './reports.validation';
import * as ctrl from './reports.controller';

const router = Router();

// docs/11-complete-api-contracts.md: GET /reports/{reportKey} (generic,
// filters via query), permission key `reports.view.{scope}`.
router.get(
  '/reports/:reportKey',
  authMiddleware,
  requirePermission('reports', 'view'),
  validate(reportKeyParamSchema, 'params'),
  validate(reportQuerySchema, 'query'),
  ctrl.runReportHandler
);

export default router;
