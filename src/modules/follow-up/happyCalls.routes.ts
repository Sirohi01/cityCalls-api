import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordHappyCallOutcomeSchema, reassignHappyCallSchema, listHappyCallsQuerySchema } from './happyCalls.validation';
import * as ctrl from './happyCalls.controller';

const router = Router();

router.get('/happy-calls', authMiddleware, requirePermission('happyCalls', 'view'), validate(listHappyCallsQuerySchema, 'query'), ctrl.listHappyCallsHandler);
router.get('/happy-calls/:id', authMiddleware, requirePermission('happyCalls', 'view'), ctrl.getHappyCallHandler);
router.patch('/happy-calls/:id/outcome', authMiddleware, requirePermission('happyCalls', 'edit'), validate(recordHappyCallOutcomeSchema), ctrl.recordOutcomeHandler);
router.patch('/happy-calls/:id/reassign', authMiddleware, requirePermission('happyCalls', 'edit'), validate(reassignHappyCallSchema), ctrl.reassignHappyCallHandler);

router.get('/reopen-requests', authMiddleware, requirePermission('happyCalls', 'view'), ctrl.listReopenRequestsHandler);

export default router;
