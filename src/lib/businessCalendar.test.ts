import { addBusinessMinutes } from './businessCalendar';

const branch = {
  workingHours: [
    { day: 1, openTime: '09:00', closeTime: '18:00', closed: false }, // Monday
    { day: 2, openTime: '09:00', closeTime: '18:00', closed: false }, // Tuesday
    { day: 3, openTime: '09:00', closeTime: '18:00', closed: false }, // Wednesday
    { day: 4, openTime: '09:00', closeTime: '18:00', closed: false }, // Thursday
    { day: 5, openTime: '09:00', closeTime: '18:00', closed: false }, // Friday
  ],
  holidays: [] as Date[],
};

describe('addBusinessMinutes', () => {
  it('adds minutes within the same working window without crossing into non-working hours', () => {
    const start = new Date('2026-07-13T10:00:00'); // a Monday, 10:00 AM
    const result = addBusinessMinutes(start, 60, branch);
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(13);
  });

  it('rolls over to the next working day when the window is exceeded', () => {
    const start = new Date('2026-07-13T17:30:00'); // Monday, 30 min before close
    const result = addBusinessMinutes(start, 90, branch); // needs 60 more minutes than available today
    // Should land on Tuesday, 09:00 + 60min = 10:00
    expect(result.getDate()).toBe(14);
    expect(result.getHours()).toBe(10);
  });

  it('skips a non-working day (weekend) entirely', () => {
    const start = new Date('2026-07-17T17:30:00'); // Friday, 30 min before close
    const result = addBusinessMinutes(start, 90, branch);
    // Saturday/Sunday are not in workingHours -> should land on Monday 10:00
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(10);
  });

  it('skips a configured holiday', () => {
    const branchWithHoliday = {
      ...branch,
      holidays: [new Date('2026-07-14T00:00:00')], // Tuesday is a holiday
    };
    const start = new Date('2026-07-13T17:30:00'); // Monday, 30 min before close
    const result = addBusinessMinutes(start, 90, branchWithHoliday);
    // Tuesday is a holiday, so should skip to Wednesday 10:00
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(10);
  });

  it('falls back to plain wall-clock addition when no branch is provided', () => {
    const start = new Date('2026-07-13T23:00:00');
    const result = addBusinessMinutes(start, 120, null);
    expect(result.getTime()).toBe(start.getTime() + 120 * 60_000);
  });
});
