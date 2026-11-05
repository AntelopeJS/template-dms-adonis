import { DAY_MS } from "../shared/seed";

const HOUR_MS = 60 * 60 * 1000;
const QUARTER_MS = 15 * 60 * 1000;
/** Calendar labels follow the company's time zone, Liège being in Europe/Brussels. */
const TIME_ZONE = "Europe/Brussels";

export interface TimeRange {
  from: number;
  to: number;
}

export interface Period extends TimeRange {
  /** The comparison range, when the selector compares. */
  compare?: TimeRange;
}

function instant(value: string | null): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * The period of a request. The PeriodSelector sends ISO instants (`from`,
 * `to`, and `compareFrom` / `compareTo` while comparing). Without bounds
 * (`all`, or a block outside the scope) it is the last 24 hours.
 */
export function readPeriod(query: URLSearchParams, now: number): Period {
  const from = instant(query.get("from"));
  const to = instant(query.get("to"));
  const range =
    from !== undefined && to !== undefined && to > from
      ? { from, to }
      : { from: now - DAY_MS, to: now };
  const compareFrom = instant(query.get("compareFrom"));
  const compareTo = instant(query.get("compareTo"));
  if (compareFrom === undefined || compareTo === undefined) return range;
  return { ...range, compare: { from: compareFrom, to: compareTo } };
}

/** The bucket of the production chart: 15 min, 1 h or 1 day. */
export function chartBucket(range: TimeRange): number {
  const span = range.to - range.from;
  if (span <= 2 * DAY_MS) return QUARTER_MS;
  if (span <= 8 * DAY_MS) return HOUR_MS;
  return DAY_MS;
}

/** The bucket of a site's sparkline: hours up to two days, days beyond. */
export function sparklineBucket(range: TimeRange): number {
  return range.to - range.from <= 2 * DAY_MS ? HOUR_MS : DAY_MS;
}

/**
 * The starts of the buckets of `size` covering the range. Day buckets keep
 * the period's own (local) midnight as their edge.
 */
export function bucketStarts(range: TimeRange, size: number): number[] {
  const first = Math.floor(range.from / size) * size;
  const start = size === DAY_MS ? range.from : first;
  const starts: number[] = [];
  for (let at = start; at < range.to; at += size) starts.push(at);
  return starts;
}

/** Wall-clock fields of an instant in Brussels. */
export interface LocalTime {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  hour: number;
  /** YYYY-MM-DD, for grouping by local day. */
  date: string;
}

const LOCAL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localFields(ms: number) {
  const fields: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of LOCAL_FORMAT.formatToParts(ms)) {
    if (part.type !== "literal") fields[part.type] = Number(part.value);
  }
  return fields;
}

function pad(value: number | undefined): string {
  return String(value ?? 0).padStart(2, "0");
}

export function localTime(ms: number): LocalTime {
  const { year = 0, month = 1, day = 1, hour = 0 } = localFields(ms);
  return {
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour,
    date: `${year}-${pad(month)}-${pad(day)}`,
  };
}

/** The instant of the Brussels midnight starting the day of `ms`. */
export function startOfLocalDay(ms: number): number {
  const fields = localFields(ms);
  const { year = 0, month = 1, day = 1 } = fields;
  const asUtc = Date.UTC(
    year,
    month - 1,
    day,
    fields.hour ?? 0,
    fields.minute ?? 0,
    fields.second ?? 0,
  );
  const offset = Math.round((asUtc - ms) / 60000) * 60000;
  return Date.UTC(year, month - 1, day) - offset;
}
