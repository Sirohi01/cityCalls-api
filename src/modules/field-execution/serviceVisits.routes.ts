import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  updateInspectionSchema,
  addPartsSchema,
  updateWorkSchema,
  completeVisitSchema,
  syncBatchSchema,
} from './serviceVisits.validation';
import * as ctrl from './serviceVisits.controller';

const router = Router();

router.get('/service-requests/:id/visits', authMiddleware, requirePermission('fieldExecution', 'view'), ctrl.listVisitsHandler);
router.patch('/service-requests/:id/visits/inspection', authMiddleware, requirePermission('fieldExecution', 'edit'), validate(updateInspectionSchema), ctrl.updateInspectionHandler);
router.post('/service-requests/:id/visits/parts', authMiddleware, requirePermission('fieldExecution', 'edit'), validate(addPartsSchema), ctrl.addPartsHandler);
router.patch('/service-requests/:id/visits/work', authMiddleware, requirePermission('fieldExecution', 'edit'), validate(updateWorkSchema), ctrl.updateWorkHandler);
router.post('/service-requests/:id/visits/complete', authMiddleware, requirePermission('fieldExecution', 'edit'), validate(completeVisitSchema), ctrl.completeVisitHandler);

// Offline-sync entry point — docs/manish/09-vendor-app-functional-plan.md §2.
router.post('/service-requests/:id/sync-batch', authMiddleware, requirePermission('fieldExecution', 'edit'), validate(syncBatchSchema), ctrl.syncBatchHandler);

export default router;
