import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createLeadSchema,
  updateLeadSchema,
  changeLeadStageSchema,
  addLeadNoteSchema,
  convertLeadSchema,
  bulkAssignLeadsSchema,
  mergeLeadsSchema,
  listLeadsQuerySchema,
} from './leads.validation';
import * as ctrl from './leads.controller';

const router = Router();

router.get('/leads', authMiddleware, requirePermission('leads', 'view'), validate(listLeadsQuerySchema, 'query'), ctrl.listLeadsHandler);
router.post('/leads/bulk-assign', authMiddleware, requirePermission('leads', 'edit'), validate(bulkAssignLeadsSchema), ctrl.bulkAssignHandler);
router.post('/leads/merge', authMiddleware, requirePermission('leads', 'edit'), validate(mergeLeadsSchema), ctrl.mergeLeadsHandler);
router.get('/leads/:id', authMiddleware, requirePermission('leads', 'view'), ctrl.getLeadHandler);
router.post('/leads', authMiddleware, requirePermission('leads', 'create'), validate(createLeadSchema), ctrl.createLeadHandler);
router.patch('/leads/:id', authMiddleware, requirePermission('leads', 'edit'), validate(updateLeadSchema), ctrl.updateLeadHandler);
router.patch('/leads/:id/stage', authMiddleware, requirePermission('leads', 'edit'), validate(changeLeadStageSchema), ctrl.changeStageHandler);
router.post('/leads/:id/notes', authMiddleware, requirePermission('leads', 'edit'), validate(addLeadNoteSchema), ctrl.addNoteHandler);
router.post('/leads/:id/convert', authMiddleware, requirePermission('leads', 'edit'), validate(convertLeadSchema), ctrl.convertLeadHandler);

export default router;
