import { z } from 'zod';

export const listAppointmentSlotsQuerySchema = z.object({
  branchId: z.string().min(1),
  date: z.coerce.date(),
});
