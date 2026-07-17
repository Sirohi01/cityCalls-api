import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listAuditLogsQuerySchema } from './audit.validation';
import * as ctrl from './audit.controller';

const router = Router();

// Audit logs are sensitive (who changed what, when) — gated the same way
// notification-templates and masters config-management are (config.manageSettings),
// rather than a general 'view' permission every role would otherwise get by default.
router.get('/audit/logs', authMiddleware, requirePermission('config', 'manageSettings'), validate(listAuditLogsQuerySchema, 'query'), ctrl.listAuditLogsHandler);

export default router;