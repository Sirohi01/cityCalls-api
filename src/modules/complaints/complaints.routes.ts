import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createComplaintSchema, respondComplaintSchema, updateComplaintStatusSchema, listComplaintsQuerySchema } from './complaints.validation';
import * as ctrl from './complaints.controller';

const router = Router();

router.get('/complaints', authMiddleware, requirePermission('complaints', 'view'), validate(listComplaintsQuerySchema, 'query'), ctrl.listComplaintsHandler);
router.get('/complaints/:id', authMiddleware, requirePermission('complaints', 'view'), ctrl.getComplaintHandler);
router.post('/complaints', authMiddleware, requirePermission('complaints', 'create'), validate(createComplaintSchema), ctrl.createComplaintHandler);
router.patch('/complaints/:id/respond', authMiddleware, requirePermission('complaints', 'edit'), validate(respondComplaintSchema), ctrl.respondComplaintHandler);
router.patch('/complaints/:id/status', authMiddleware, requirePermission('complaints', 'edit'), validate(updateComplaintStatusSchema), ctrl.updateComplaintStatusHandler);

export default router;
