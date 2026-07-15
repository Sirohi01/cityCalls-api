import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCampaignSchema, listCampaignsQuerySchema } from './campaigns.validation';
import * as ctrl from './campaigns.controller';

const router = Router();

router.get('/campaigns', authMiddleware, requirePermission('marketing', 'view'), validate(listCampaignsQuerySchema, 'query'), ctrl.listCampaignsHandler);
router.get('/campaigns/:id', authMiddleware, requirePermission('marketing', 'view'), ctrl.getCampaignHandler);
router.post('/campaigns', authMiddleware, requirePermission('marketing', 'create'), validate(createCampaignSchema), ctrl.createCampaignHandler);
router.post('/campaigns/:id/send', authMiddleware, requirePermission('marketing', 'edit'), ctrl.sendCampaignHandler);

export default router;
