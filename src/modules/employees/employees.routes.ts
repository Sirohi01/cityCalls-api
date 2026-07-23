import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema } from './employees.validation';
import * as ctrl from './employees.controller';

const router = Router();

router.get('/employees', authMiddleware, requirePermission('employees', 'view'), validate(listEmployeesQuerySchema, 'query'), ctrl.listEmployeesHandler);
router.get('/employees/:id', authMiddleware, requirePermission('employees', 'view'), ctrl.getEmployeeHandler);
router.post('/employees', authMiddleware, requirePermission('employees', 'create'), validate(createEmployeeSchema), ctrl.createEmployeeHandler);
router.patch('/employees/:id', authMiddleware, requirePermission('employees', 'edit'), validate(updateEmployeeSchema), ctrl.updateEmployeeHandler);
router.delete('/employees/:id', authMiddleware, requirePermission('employees', 'edit'), ctrl.deleteEmployeeHandler);

export default router;
