import { Response, NextFunction } from 'express';
import * as appointmentSlotsService from './appointmentSlots.service';
import { sendSuccess } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';

export async function listAppointmentSlotsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const { branchId, date } = req.query as unknown as { branchId: string; date: Date };
    const result = await appointmentSlotsService.getAppointmentSlots(branchId, date);
    sendSuccess(res, result, 'Appointment slots fetched successfully');
  } catch (err) {
    next(err);
  }
}
