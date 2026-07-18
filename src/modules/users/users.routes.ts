import { Router, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, ScopedRequest } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { ForbiddenError } from '../../lib/errors';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  rolePermissionRoleParamSchema,
  rolePermissionIdParamSchema,
  createRolePermissionSchema,
  updateRolePermissionSchema,
} from './users.validation';
import * as ctrl from './users.controller';

const router = Router();

// Editing role-permission grants is a privilege-escalation-sensitive surface —
// 'users'.'manageSettings' is also granted to ADMIN in the seed, so this adds
// a hard, role-literal gate on top: only SUPER_ADMIN may reach these routes.
function requireSuperAdminOnly(req: ScopedRequest, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'SUPER_ADMIN') {
    next(new ForbiddenError('Only Super Admin can manage role permissions'));
    return;
  }
  next();
}

router.get('/users', authMiddleware, requirePermission('users', 'view'), validate(listUsersQuerySchema, 'query'), ctrl.listUsersHandler);
router.get('/users/:id', authMiddleware, requirePermission('users', 'view'), ctrl.getUserHandler);
router.post('/users', authMiddleware, requirePermission('users', 'create'), validate(createUserSchema), ctrl.createUserHandler);
router.patch('/users/:id', authMiddleware, requirePermission('users', 'edit'), validate(updateUserSchema), ctrl.updateUserHandler);

router.get('/roles', authMiddleware, requirePermission('users', 'view'), ctrl.listRolesHandler);
router.post(
  '/roles/:role/permissions',
  authMiddleware,
  requirePermission('users', 'manageSettings'),
  requireSuperAdminOnly,
  validate(rolePermissionRoleParamSchema, 'params'),
  validate(createRolePermissionSchema),
  ctrl.createRolePermissionHandler
);
router.patch(
  '/roles/:role/permissions/:id',
  authMiddleware,
  requirePermission('users', 'manageSettings'),
  requireSuperAdminOnly,
  validate(rolePermissionIdParamSchema, 'params'),
  validate(updateRolePermissionSchema),
  ctrl.updateRolePermissionHandler
);
router.delete(
  '/roles/:role/permissions/:id',
  authMiddleware,
  requirePermission('users', 'manageSettings'),
  requireSuperAdminOnly,
  validate(rolePermissionIdParamSchema, 'params'),
  ctrl.deleteRolePermissionHandler
);

export default router;
