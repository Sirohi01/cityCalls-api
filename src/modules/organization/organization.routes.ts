import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createBranchSchema,
  updateBranchSchema,
  createSubBranchSchema,
  updateSubBranchSchema,
  createTeamSchema,
  updateTeamSchema,
  listQuerySchema,
} from './organization.validation';
import * as ctrl from './organization.controller';

// authMiddleware is applied per-route (not via router.use()) so that a request to
// an unmatched path under this router's mount point still falls through to the
// app-level 404 handler instead of being intercepted as a blanket 401. See
// test/integration/health.test.ts for the regression this guards against.
const router = Router();

// Branches
router.get('/branches', authMiddleware, requirePermission('organization', 'view'), validate(listQuerySchema, 'query'), ctrl.listBranchesHandler);
router.get('/branches/:id', authMiddleware, requirePermission('organization', 'view'), ctrl.getBranchHandler);
router.post('/branches', authMiddleware, requirePermission('organization', 'create'), validate(createBranchSchema), ctrl.createBranchHandler);
router.patch('/branches/:id', authMiddleware, requirePermission('organization', 'edit'), validate(updateBranchSchema), ctrl.updateBranchHandler);

// Sub-branches
router.get('/sub-branches', authMiddleware, requirePermission('organization', 'view'), validate(listQuerySchema, 'query'), ctrl.listSubBranchesHandler);
router.post('/sub-branches', authMiddleware, requirePermission('organization', 'create'), validate(createSubBranchSchema), ctrl.createSubBranchHandler);
router.patch('/sub-branches/:id', authMiddleware, requirePermission('organization', 'edit'), validate(updateSubBranchSchema), ctrl.updateSubBranchHandler);

// Teams
router.get('/teams', authMiddleware, requirePermission('organization', 'view'), validate(listQuerySchema, 'query'), ctrl.listTeamsHandler);
router.post('/teams', authMiddleware, requirePermission('organization', 'create'), validate(createTeamSchema), ctrl.createTeamHandler);
router.patch('/teams/:id', authMiddleware, requirePermission('organization', 'edit'), validate(updateTeamSchema), ctrl.updateTeamHandler);

export default router;
