import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createMasterSchema, updateMasterSchema, listMastersQuerySchema, masterTypeParamSchema, masterIdParamSchema } from './config.validation';
import * as ctrl from './config.controller';

// authMiddleware is applied per-route rather than via router.use() — see the comment
// in organization.routes.ts for why (avoids masking 404s as blanket 401s).
const router = Router();

router.get(
  '/masters/:masterType',
  authMiddleware,
  requirePermission('config', 'view'),
  validate(masterTypeParamSchema, 'params'),
  validate(listMastersQuerySchema, 'query'),
  ctrl.listMastersHandler
);
router.post(
  '/masters/:masterType',
  authMiddleware,
  requirePermission('config', 'manageSettings'),
  validate(masterTypeParamSchema, 'params'),
  validate(createMasterSchema),
  ctrl.createMasterHandler
);
router.patch(
  '/masters/:masterType/:id',
  authMiddleware,
  requirePermission('config', 'manageSettings'),
  validate(masterIdParamSchema, 'params'),
  validate(updateMasterSchema),
  ctrl.updateMasterHandler
);
router.delete(
  '/masters/:masterType/:id',
  authMiddleware,
  requirePermission('config', 'manageSettings'),
  validate(masterIdParamSchema, 'params'),
  ctrl.deleteMasterHandler
);

export default router;
