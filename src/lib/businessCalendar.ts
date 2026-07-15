import { IBranch } from '../modules/organization/organization.model';

// Working-hours/holiday-aware SLA calculation — docs/manish/06-workflow-engine-plan.md §5.
// SLA due dates skip time outside the branch's working hours and holidays, rather
// than naive wall-clock addition, which would understate real turnaround time for
// anything scheduled near closing time or over a holiday.

function isHoliday(date: Date, holidays: Date[]): boolean {
  return holidays.some((h) => h.toDateString() === date.toDateString());
}

function parseTimeOnDay(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

interface WorkingWindow {
  open: Date;
  close: Date;
}

function getWorkingWindow(date: Date, branch: Pick<IBranch, 'workingHours' | 'holidays'>): WorkingWindow | null {
  if (isHoliday(date, branch.holidays)) return null;

  const dayOfWeek = date.getDay();
  const rule = branch.workingHours.find((w) => w.day === dayOfWeek);
  if (!rule || rule.closed || !rule.openTime || !rule.closeTime) return null;

  return {
    open: parseTimeOnDay(date, rule.openTime),
    close: parseTimeOnDay(date, rule.closeTime),
  };
}

// Adds `minutes` of business time to `start`, skipping non-working hours and
// holidays, and returns the resulting due date/time.
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  branch: Pick<IBranch, 'workingHours' | 'holidays'> | null
): Date {
  // No branch (or no working-hours configured) — fall back to plain wall-clock
  // addition rather than blocking SLA calculation entirely.
  if (!branch || branch.workingHours.length === 0) {
    return new Date(start.getTime() + minutes * 60_000);
  }

  let remaining = minutes;
  let cursor = new Date(start);
  let guardDays = 0;

  while (remaining > 0 && guardDays < 365) {
    const window = getWorkingWindow(cursor, branch);

    if (window) {
      const windowStart = cursor < window.open ? window.open : cursor;
      if (windowStart < window.close) {
        const availableMs = window.close.getTime() - windowStart.getTime();
        const availableMinutes = availableMs / 60_000;

        if (remaining <= availableMinutes) {
          return new Date(windowStart.getTime() + remaining * 60_000);
        }
        remaining -= availableMinutes;
      }
    }

    // Move to the start of the next day.
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
    guardDays += 1;
  }

  return cursor;
}
