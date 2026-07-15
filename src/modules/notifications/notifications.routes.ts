import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listNotificationsQuerySchema } from './notifications.validation';
import * as ctrl from './notifications.controller';

const router = Router();

// Self-scoped (every authenticated user reads only their own notifications) —
// no requirePermission gate needed, same pattern as /auth/sessions.
router.get('/notifications', authMiddleware, validate(listNotificationsQuerySchema, 'query'), ctrl.listMyNotificationsHandler);
router.get('/notifications/unread-count', authMiddleware, ctrl.unreadCountHandler);
router.patch('/notifications/:id/read', authMiddleware, ctrl.markReadHandler);

// Admin template management — module-permission gated.
router.get('/notification-templates', authMiddleware, requirePermission('config', 'manageSettings'), ctrl.listTemplatesHandler);
router.patch('/notification-templates/:id', authMiddleware, requirePermission('config', 'manageSettings'), ctrl.updateTemplateHandler);

export default router;
