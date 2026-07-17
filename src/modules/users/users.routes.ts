import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from './users.validation';
import * as ctrl from './users.controller';

const router = Router();

router.get('/users', authMiddleware, requirePermission('users', 'view'), validate(listUsersQuerySchema, 'query'), ctrl.listUsersHandler);
router.get('/users/:id', authMiddleware, requirePermission('users', 'view'), ctrl.getUserHandler);
router.post('/users', authMiddleware, requirePermission('users', 'create'), validate(createUserSchema), ctrl.createUserHandler);
router.patch('/users/:id', authMiddleware, requirePermission('users', 'edit'), validate(updateUserSchema), ctrl.updateUserHandler);

router.get('/roles', authMiddleware, requirePermission('users', 'view'), ctrl.listRolesHandler);

export default router;
