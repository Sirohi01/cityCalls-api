import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateAiSettingsSchema, summarizeCallSchema, classifyComplaintSchema } from './ai.validation';
import * as ctrl from './ai.controller';

const router = Router();

// docs/11-complete-api-contracts.md AI row: GET/PATCH /ai/settings,
// POST /ai/summarize-call, POST /ai/classify-complaint — all gated by the
// 'ai' module permission. Settings management is manageSettings-scoped
// (Admin/Super Admin only, per docs/05-user-roles-and-permissions.md's AI
// Settings row); the two feature endpoints use 'create' since each call is
// its own AI request, matching the action vocabulary already used elsewhere.
router.get('/ai/settings', authMiddleware, requirePermission('ai', 'manageSettings'), ctrl.getSettingsHandler);
router.patch('/ai/settings', authMiddleware, requirePermission('ai', 'manageSettings'), validate(updateAiSettingsSchema), ctrl.updateSettingsHandler);
router.post('/ai/summarize-call', authMiddleware, requirePermission('ai', 'create'), validate(summarizeCallSchema), ctrl.summarizeCallHandler);
router.post('/ai/classify-complaint', authMiddleware, requirePermission('ai', 'create'), validate(classifyComplaintSchema), ctrl.classifyComplaintHandler);

export default router;
