import { helioNow } from "../shared/clock";
function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Whole calendar days from `dueAt` to `now` in the office's time zone: 0 on
 * the due day itself, whatever hour the due date was stamped with. Calendar
 * dates are compared rather than 24-hour spans, so a daylight-saving night
 * still counts as one day.
 */
export function daysLate(dueAt: Date, now = helioNow()): number {
  const from = new Date(startOfDay(dueAt.getTime()));
  const to = new Date(startOfDay(now));
  const utc = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc(to) - utc(from)) / (24 * 60 * 60 * 1000));
}

/** Whether the due date is over: from the day after it. */
export function isPastDue(dueAt: Date, now = helioNow()): boolean {
  return daysLate(dueAt, now) >= 1;
}
