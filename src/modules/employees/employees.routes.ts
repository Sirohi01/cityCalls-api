import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema, fcmTokenSchema, updateAvailabilitySchema } from './employees.validation';
import * as ctrl from './employees.controller';

const router = Router();

router.get('/employees', authMiddleware, requirePermission('employees', 'view'), validate(listEmployeesQuerySchema, 'query'), ctrl.listEmployeesHandler);
// Must precede '/employees/:id' — otherwise Express would match "me" as :id.
router.get('/employees/me', authMiddleware, requirePermission('employees', 'view'), ctrl.getOwnEmployeeHandler);
router.post('/employees/me/fcm-token', authMiddleware, requirePermission('employees', 'edit'), validate(fcmTokenSchema), ctrl.registerFcmTokenHandler);
router.delete('/employees/me/fcm-token', authMiddleware, requirePermission('employees', 'edit'), validate(fcmTokenSchema), ctrl.unregisterFcmTokenHandler);
router.patch('/employees/me/availability', authMiddleware, requirePermission('employees', 'edit'), validate(updateAvailabilitySchema), ctrl.updateOwnAvailabilityHandler);
router.get('/employees/:id', authMiddleware, requirePermission('employees', 'view'), ctrl.getEmployeeHandler);
router.post('/employees', authMiddleware, requirePermission('employees', 'create'), validate(createEmployeeSchema), ctrl.createEmployeeHandler);
router.patch('/employees/:id', authMiddleware, requirePermission('employees', 'edit'), validate(updateEmployeeSchema), ctrl.updateEmployeeHandler);
router.delete('/employees/:id', authMiddleware, requirePermission('employees', 'edit'), ctrl.deleteEmployeeHandler);

export default router;
