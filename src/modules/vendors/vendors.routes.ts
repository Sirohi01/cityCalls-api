import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createVendorSchema,
  updateVendorSchema,
  blacklistVendorSchema,
  listVendorsQuerySchema,
  createVendorTechnicianSchema,
} from './vendors.validation';
import * as ctrl from './vendors.controller';

const router = Router();

router.get('/vendors', authMiddleware, requirePermission('vendors', 'view'), validate(listVendorsQuerySchema, 'query'), ctrl.listVendorsHandler);
router.get('/vendors/:id', authMiddleware, requirePermission('vendors', 'view'), ctrl.getVendorHandler);
router.post('/vendors', authMiddleware, requirePermission('vendors', 'create'), validate(createVendorSchema), ctrl.createVendorHandler);
router.patch('/vendors/:id', authMiddleware, requirePermission('vendors', 'edit'), validate(updateVendorSchema), ctrl.updateVendorHandler);
router.patch(
  '/vendors/:id/blacklist',
  authMiddleware,
  requirePermission('vendors', 'edit'),
  validate(blacklistVendorSchema),
  ctrl.setBlacklistHandler
);
router.get('/vendors/:id/technicians', authMiddleware, requirePermission('vendors', 'view'), ctrl.listVendorTechniciansHandler);
router.post(
  '/vendors/:id/technicians',
  authMiddleware,
  requirePermission('vendors', 'edit'),
  validate(createVendorTechnicianSchema),
  ctrl.createVendorTechnicianHandler
);

export default router;
