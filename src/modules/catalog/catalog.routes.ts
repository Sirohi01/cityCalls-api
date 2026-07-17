import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createServiceSchema, updateServiceSchema, listServicesQuerySchema } from './catalog.validation';
import * as ctrl from './catalog.controller';

const router = Router();

router.get('/services', authMiddleware, requirePermission('catalog', 'view'), validate(listServicesQuerySchema, 'query'), ctrl.listServicesHandler);
router.get('/services/:id', authMiddleware, requirePermission('catalog', 'view'), ctrl.getServiceHandler);
router.get('/services/:id/coverage', authMiddleware, requirePermission('catalog', 'view'), ctrl.checkCoverageHandler);
router.post('/services', authMiddleware, requirePermission('catalog', 'create'), validate(createServiceSchema), ctrl.createServiceHandler);
router.patch('/services/:id', authMiddleware, requirePermission('catalog', 'edit'), validate(updateServiceSchema), ctrl.updateServiceHandler);

router.get('/brands', authMiddleware, requirePermission('catalog', 'view'), ctrl.listBrandsHandler);

export default router;
