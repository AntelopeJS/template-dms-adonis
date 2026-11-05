import { DAY_MS, type Rng } from "../shared/seed";
import { helioNow } from "../shared/clock";

/**
 * Relative weight of the installations starting in each month, January first:
 * a slow winter, the spring and summer peak of a solar installer, and a busy
 * September.
 */
const MONTH_WEIGHTS = [2, 4, 7, 9, 10, 10, 8, 7, 9, 7, 4, 2] as const;

/** Midnight of the day `offset` days from today (negative for the past). */
export function dayAt(offset: number): Date {
  const date = new Date(helioNow() + offset * DAY_MS);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Whether the crews work that day: Monday to Friday. */
export function isWorkday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** The date moved by `count` working days (backwards when negative). */
export function addWorkdays(date: Date, count: number): Date {
  const result = new Date(date);
  const step = count < 0 ? -1 : 1;
  let left = Math.abs(count);
  while (left > 0) {
    result.setDate(result.getDate() + step);
    if (isWorkday(result)) left -= 1;
  }
  return result;
}

/** The date itself on a working day, else the next working day. */
export function nextWorkday(date: Date): Date {
  const result = new Date(date);
  while (!isWorkday(result)) result.setDate(result.getDate() + 1);
  return result;
}

/** The date itself on a working day, else the working day before. */
export function previousWorkday(date: Date): Date {
  const result = new Date(date);
  while (!isWorkday(result)) result.setDate(result.getDate() - 1);
  return result;
}

/** The same day at a given hour. */
export function atHour(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}

/** A working day between `from` and `to` days from today, at random. */
export function workdayBetween(rng: Rng, from: number, to: number): Date {
  return nextWorkday(dayAt(rng.int(from, to)));
}

/**
 * `count` working days between `from` and `to` days from today, oldest
 * first, spread like the season: each project takes the day where the
 * running seasonal weight reaches its share, so busy months get more starts.
 */
export function seasonalWorkdays(
  rng: Rng,
  count: number,
  from: number,
  to: number,
): Date[] {
  const days: Date[] = [];
  const cumulative: number[] = [];
  let total = 0;
  for (let offset = from; offset <= to; offset++) {
    const day = dayAt(offset);
    if (!isWorkday(day)) continue;
    total += MONTH_WEIGHTS[day.getMonth()] ?? 1;
    days.push(day);
    cumulative.push(total);
  }
  return Array.from({ length: count }, (_, index) => {
    const target = ((index + 0.25 + rng.next() * 0.5) / count) * total;
    const at = cumulative.findIndex((weight) => weight >= target);
    return days[at === -1 ? days.length - 1 : at] ?? dayAt(to);
  });
}
