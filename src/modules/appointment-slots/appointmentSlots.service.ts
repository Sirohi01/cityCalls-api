import { MasterModel } from '../config/master.model';
import { BranchModel } from '../organization/organization.model';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { isBranchOpenOn } from '../../lib/businessCalendar';

// Per docs/manish/08-customer-app-functional-plan.md §2's
// GET /appointment-slots?branchId=&date= — per-branch capacity (not
// per-technician, no vendor app/technician-scheduling system exists yet),
// checked against the shared APPOINTMENT_SLOT master list.

function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export interface SlotAvailability {
  key: string;
  label: string;
  startTime?: string;
  endTime?: string;
  capacity: number;
  booked: number;
  remaining: number;
  available: boolean;
}

export async function getAppointmentSlots(branchId: string, date: Date): Promise<{ dayClosed: boolean; slots: SlotAvailability[] }> {
  const branch = await BranchModel.findById(branchId);
  if (!branch || !branch.active) throw new NotFoundError('Branch not found');

  if (!isBranchOpenOn(date, branch)) {
    return { dayClosed: true, slots: [] };
  }

  const masters = await MasterModel.find({ masterType: 'APPOINTMENT_SLOT', active: true }).sort({ sortOrder: 1 });
  const { start, end } = dayRange(date);

  const counts = await ServiceRequestModel.aggregate<{ _id: string; count: number }>([
    { $match: { branchId: branch._id, scheduledDate: { $gte: start, $lt: end }, scheduledSlot: { $ne: null }, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$scheduledSlot', count: { $sum: 1 } } },
  ]);
  const bookedByLabel = new Map(counts.map((c) => [c._id, c.count]));

  const capacity = branch.dailyCapacityPerSlot;
  const slots: SlotAvailability[] = masters.map((m) => {
    const booked = bookedByLabel.get(m.label) ?? 0;
    const remaining = Math.max(0, capacity - booked);
    return {
      key: m.key,
      label: m.label,
      startTime: (m.meta as { startTime?: string } | undefined)?.startTime,
      endTime: (m.meta as { endTime?: string } | undefined)?.endTime,
      capacity,
      booked,
      remaining,
      available: remaining > 0,
    };
  });

  return { dayClosed: false, slots };
}

// Re-checked server-side at write time (service-request creation and
// reschedule) — the listing above is advisory for the client's UI, this is
// the actual enforcement point that closes the race between two customers
// booking the same last-open slot.
export async function assertSlotAvailable(branchId: string, date: Date, slotLabel: string): Promise<void> {
  const branch = await BranchModel.findById(branchId);
  if (!branch) return;

  if (!isBranchOpenOn(date, branch)) {
    throw new ConflictError('This branch is closed on the selected date', 'SLOT_DAY_CLOSED');
  }

  const { start, end } = dayRange(date);
  const booked = await ServiceRequestModel.countDocuments({
    branchId: branch._id,
    scheduledDate: { $gte: start, $lt: end },
    scheduledSlot: slotLabel,
    status: { $ne: 'CANCELLED' },
  });

  if (booked >= branch.dailyCapacityPerSlot) {
    throw new ConflictError('This time slot is fully booked, please pick another', 'SLOT_FULL');
  }
}
