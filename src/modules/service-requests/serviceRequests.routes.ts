import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createServiceRequestSchema,
  changeStatusSchema,
  assignSchema,
  reassignSchema,
  cancelSchema,
  reopenSchema,
  verifyCompletionOtpSchema,
  locationPingSchema,
  listServiceRequestsQuerySchema,
} from './serviceRequests.validation';
import * as ctrl from './serviceRequests.controller';

const router = Router();

router.get('/service-requests', authMiddleware, requirePermission('serviceRequests', 'view'), validate(listServiceRequestsQuerySchema, 'query'), ctrl.listServiceRequestsHandler);
router.get('/service-requests/:id', authMiddleware, requirePermission('serviceRequests', 'view'), ctrl.getServiceRequestHandler);
router.post('/service-requests', authMiddleware, requirePermission('serviceRequests', 'create'), validate(createServiceRequestSchema), ctrl.createServiceRequestHandler);
router.patch('/service-requests/:id/status', authMiddleware, requirePermission('serviceRequests', 'edit'), validate(changeStatusSchema), ctrl.changeStatusHandler);
router.post('/service-requests/:id/assign', authMiddleware, requirePermission('serviceRequests', 'assign'), validate(assignSchema), ctrl.assignHandler);
router.post('/service-requests/:id/reassign', authMiddleware, requirePermission('serviceRequests', 'assign'), validate(reassignSchema), ctrl.reassignHandler);
router.get('/service-requests/:id/assignment-candidates', authMiddleware, requirePermission('serviceRequests', 'assign'), ctrl.assignmentCandidatesHandler);
router.get('/service-requests/:id/assignment-history', authMiddleware, requirePermission('serviceRequests', 'view'), ctrl.assignmentHistoryHandler);
router.post('/service-requests/:id/cancel', authMiddleware, requirePermission('serviceRequests', 'edit'), validate(cancelSchema), ctrl.cancelHandler);
router.post('/service-requests/:id/reopen', authMiddleware, requirePermission('serviceRequests', 'edit'), validate(reopenSchema), ctrl.reopenHandler);
router.get('/service-requests/:id/reopen-history', authMiddleware, requirePermission('serviceRequests', 'view'), ctrl.reopenHistoryHandler);
router.post('/service-requests/:id/completion-otp/request', authMiddleware, requirePermission('serviceRequests', 'edit'), ctrl.requestCompletionOtpHandler);
router.post('/service-requests/:id/completion-otp/verify', authMiddleware, requirePermission('serviceRequests', 'edit'), validate(verifyCompletionOtpSchema), ctrl.verifyCompletionOtpHandler);
router.post('/service-requests/:id/location-ping', authMiddleware, requirePermission('serviceRequests', 'edit'), validate(locationPingSchema), ctrl.locationPingHandler);

export default router;
