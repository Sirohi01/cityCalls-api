import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCallSchema, updateCallSchema, listCallsQuerySchema } from './calls.validation';
import * as ctrl from './calls.controller';

const router = Router();

router.get('/calls', authMiddleware, requirePermission('calls', 'view'), validate(listCallsQuerySchema, 'query'), ctrl.listCallsHandler);
router.get('/calls/:id', authMiddleware, requirePermission('calls', 'view'), ctrl.getCallHandler);
router.post('/calls', authMiddleware, requirePermission('calls', 'create'), validate(createCallSchema), ctrl.createCallHandler);
router.patch('/calls/:id', authMiddleware, requirePermission('calls', 'edit'), validate(updateCallSchema), ctrl.updateCallHandler);

export default router;
