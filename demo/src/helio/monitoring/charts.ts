import type { ComposedText } from "@antelopejs/interface-dms/base/types";
import { DAY_MS } from "../shared/seed";
import { type FleetSite, round1 } from "./fleet";
import { MONITORING_PAGE_PATH, PERIOD_SCOPE } from "./links";
import {
  bucketStarts,
  chartBucket,
  localTime,
  type Period,
  sparklineBucket,
  startOfLocalDay,
  type TimeRange,
} from "./period";
import { energyKwh } from "./solar";

const HOUR_MS = 60 * 60 * 1000;
const HEATMAP_DAYS = 7;
const TOP_SITES = 5;
/** Row names of the heatmap, Sunday first as `Date.getDay()` counts. */
const WEEKDAYS = [
  "$helio.monitoring.weekdays.sun",
  "$helio.monitoring.weekdays.mon",
  "$helio.monitoring.weekdays.tue",
  "$helio.monitoring.weekdays.wed",
  "$helio.monitoring.weekdays.thu",
  "$helio.monitoring.weekdays.fri",
  "$helio.monitoring.weekdays.sat",
] as const;

export interface Point {
  x: string;
  y: number | null;
}

export interface Series {
  name: string;
  data: Point[];
}

export interface ChartCardPayload {
  value: number;
  previousValue?: number;
  delta?: number;
  series: Series[];
  comparisonSeries?: Series[];
}

function deltaPercent(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * One point per bucket; buckets still to come stay empty so the curve stops at
 * now.
 */
function productionPoints(
  sites: readonly FleetSite[],
  starts: number[],
  size: number,
  shift: number,
  now: number,
): Point[] {
  return starts.map((start) => ({
    x: new Date(start).toISOString(),
    y:
      start + shift > now
        ? null
        : round1(energyKwh(sites, start + shift, start + shift + size, now)),
  }));
}

/**
 * The production card of some sites over the period: the energy per bucket,
 * the comparison period laid over the same axis, and the total compared on
 * the same elapsed time (today until now against yesterday until the same
 * hour, not against the whole of yesterday). Every figure of the fleet page is
 * integrated from the solar model, so the curve, the table and the headline
 * always agree.
 */
export function productionCard(
  sites: readonly FleetSite[],
  period: Period,
  now: number,
): ChartCardPayload {
  const size = chartBucket(period);
  const starts = bucketStarts(period, size);
  const value = round1(energyKwh(sites, period.from, period.to, now));
  const payload: ChartCardPayload = {
    value,
    series: [
      {
        name: "$helio.monitoring.production.series",
        data: productionPoints(sites, starts, size, 0, now),
      },
    ],
  };
  const { compare } = period;
  if (!compare) return payload;
  const elapsed = Math.min(period.to, now) - period.from;
  const previousValue = round1(
    energyKwh(sites, compare.from, compare.from + elapsed, now),
  );
  return {
    ...payload,
    previousValue,
    delta: deltaPercent(value, previousValue),
    comparisonSeries: [
      {
        name: "$helio.monitoring.production.comparisonSeries",
        data: productionPoints(
          sites,
          starts,
          size,
          compare.from - period.from,
          now,
        ),
      },
    ],
  };
}

/** Fleet energy of each hour of one local day; hours still to come read 0. */
function hoursOfDay(
  sites: readonly FleetSite[],
  dayStart: number,
  now: number,
): number[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const start = dayStart + hour * HOUR_MS;
    if (start > now) return 0;
    return Math.round(energyKwh(sites, start, start + HOUR_MS, now));
  });
}

/**
 * Fleet energy per hour over the last seven days, oldest day first: when the
 * fleet produces, and which days the clouds took. Only the hours of daylight
 * are kept, so the grid follows the season.
 */
export function heatmapSeries(sites: readonly FleetSite[], now: number) {
  const days = Array.from({ length: HEATMAP_DAYS }, (_, at) => {
    const dayStart = startOfLocalDay(now - (HEATMAP_DAYS - 1 - at) * DAY_MS);
    const weekday = WEEKDAYS[localTime(dayStart + 12 * HOUR_MS).weekday];
    return { weekday, hours: hoursOfDay(sites, dayStart, now) };
  });
  const lit = (hour: number) => days.some((day) => (day.hours[hour] ?? 0) > 0);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const first = Math.max(0, (hours.find(lit) ?? 8) - 1);
  const last = Math.min(23, ([...hours].reverse().find(lit) ?? 18) + 1);
  return {
    series: days.map(({ weekday, hours: values }) => ({
      name: weekday,
      data: values.slice(first, last + 1).map((y, at) => ({
        x: `${String(first + at).padStart(2, "0")}:00`,
        y,
      })),
    })),
  } satisfies { series: Series[] };
}

/** A site's energy per sparkline bucket over the range, oldest first. */
export function sparkline(
  site: FleetSite,
  range: TimeRange,
  now: number,
): number[] {
  const size = sparklineBucket(range);
  return bucketStarts(range, size)
    .filter((start) => start <= now)
    .map((start) => round1(energyKwh([site], start, start + size, now)));
}

const periodLink = (key: string) =>
  `${PERIOD_SCOPE}.${key}={{query.${PERIOD_SCOPE}.${key}}}`;

/** Opens the site's panel on this page, keeping the period shown. */
export function siteLink(siteId: string): string {
  const keys = ["period", "compare", "from", "to"].map(periodLink).join("&");
  return `${MONITORING_PAGE_PATH}?record=${encodeURIComponent(siteId)}&${keys}`;
}

export interface TopListItem {
  id: string;
  title: string;
  description: ComposedText;
  value: number;
  /**
   * The value as written, with its unit (the card's valueLabel), to the kWh.
   * The unit and the space before it belong to the message, not to a suffix
   * glued to the number.
   */
  valueLabel: ComposedText;
  delta: number | null;
  sparkline: number[];
  icon: string;
  to: string;
}

/** The sites that produced the most over the period. */
export function topProducers(
  sites: readonly FleetSite[],
  period: Period,
  now: number,
) {
  const elapsed = Math.min(period.to, now) - period.from;
  const items = sites.map((site): TopListItem => {
    const value = round1(energyKwh([site], period.from, period.to, now));
    const { compare } = period;
    const previous = compare
      ? energyKwh([site], compare.from, compare.from + elapsed, now)
      : 0;
    return {
      id: site.id,
      title: site.name,
      description: {
        key: "$helio.monitoring.top.itemDescription",
        params: { city: site.city, capacity: site.capacityKwp },
      },
      value,
      valueLabel: {
        key: "$helio.monitoring.units.kwhValue",
        params: { value: { type: "number", value: Math.round(value) } },
      },
      delta: compare ? (deltaPercent(value, previous) ?? null) : null,
      sparkline: sparkline(site, period, now),
      icon: "i-ph-solar-panel",
      to: siteLink(site.id),
    };
  });
  items.sort((a, b) => b.value - a.value);
  return { items: items.slice(0, TOP_SITES) };
}
