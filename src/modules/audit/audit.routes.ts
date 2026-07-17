import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as ctrl from './audit.controller';

const router = Router();

router.get('/audit/logs', authMiddleware, ctrl.listAuditLogsHandler);

export default router;
