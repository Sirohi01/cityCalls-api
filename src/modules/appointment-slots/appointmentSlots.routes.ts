import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listAppointmentSlotsQuerySchema } from './appointmentSlots.validation';
import * as ctrl from './appointmentSlots.controller';

const router = Router();

// Same 'catalog','view' permission as the coverage-check route it follows in
// the booking flow (service_detail_screen.dart -> slot_selection_screen.dart)
// — every role that can browse the catalog can check slot availability.
router.get('/appointment-slots', authMiddleware, requirePermission('catalog', 'view'), validate(listAppointmentSlotsQuerySchema, 'query'), ctrl.listAppointmentSlotsHandler);

export default router;
