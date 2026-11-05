import { DAY_MS } from "../shared/seed";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const YEAR_DAYS = 365;
const SUMMER_SOLSTICE_DOY = 172;
/** Solar noon in Liège (5.57° E) falls around 11:40 UTC all year round. */
const SOLAR_NOON_UTC_H = 11.65;
/** Clouds are drawn on knots 20 minutes apart and blended between them. */
const CLOUD_KNOT_MS = 20 * MINUTE_MS;
/** The live jitter of an inverter reading changes on every 10-second report. */
export const REPORT_INTERVAL_MS = 10 * 1000;
/** A degraded inverter delivers about half of what its panels could. */
export const DEGRADED_OUTPUT = 0.55;

/** What the model needs to know about one site. */
export interface SiteProfile {
  id: string;
  /** 1-based roster index, the seed of the site's own randomness. */
  index: number;
  capacityKwp: number;
  /** Orientation and shading (0.9–1.02) times the inverter's state. */
  factor: number;
  /** No production before the commissioning. */
  activeFrom: number;
  /** An offline inverter stopped reporting then; Infinity otherwise. */
  activeUntil: number;
}

/** A 32-bit integer hash of a few integers, folded to [0, 1). */
function hash01(...values: number[]): number {
  let state = 0x9e3779b9;
  for (const value of values) {
    state = Math.imul(state ^ (value | 0), 0x85ebca6b);
    state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
    state ^= state >>> 16;
  }
  return (state >>> 0) / 4294967296;
}

function seasonCos(ms: number): number {
  const dayOfYear = Math.floor(ms / DAY_MS) % YEAR_DAYS;
  return Math.cos(
    (2 * Math.PI * (dayOfYear - SUMMER_SOLSTICE_DOY)) / YEAR_DAYS,
  );
}

/**
 * Clear-sky output of 1 kWp at `ms`, as a fraction of its peak power. Daylight
 * lasts 16.4 h in June and 8 h in December, and tilted panels peak near
 * 0.87 kW/kWp in June and 0.43 in December.
 */
function clearSky(ms: number): number {
  const season = seasonCos(ms);
  const daylight = 12.2 + 4.2 * season;
  const peak = 0.65 + 0.22 * season;
  const hourUtc = (ms % DAY_MS) / HOUR_MS;
  const fromNoon = hourUtc - SOLAR_NOON_UTC_H;
  if (Math.abs(fromNoon) >= daylight / 2) return 0;
  return peak * Math.cos((Math.PI * fromNoon) / daylight) ** 1.5;
}

/** How clear the day of `ms` is: 0.3 (overcast) to 1 (cloudless). */
function dayClearness(ms: number): number {
  return 0.3 + 0.7 * hash01(Math.floor(ms / DAY_MS), 17);
}

/** Passing clouds: a smooth 0–1 curve shared by the whole region. */
function clouds(ms: number): number {
  const knot = Math.floor(ms / CLOUD_KNOT_MS);
  const blend = (ms - knot * CLOUD_KNOT_MS) / CLOUD_KNOT_MS;
  const eased = (1 - Math.cos(Math.PI * blend)) / 2;
  return hash01(knot, 3) * (1 - eased) + hash01(knot + 1, 3) * eased;
}

/** Output of 1 kWp at `ms` under the day's weather, in kW. */
export function irradiance(ms: number): number {
  const sky = clearSky(ms);
  if (sky === 0) return 0;
  return sky * dayClearness(ms) * (0.55 + 0.45 * clouds(ms));
}

/** The orientation factor of a site, stable for its roster index. */
export function orientationFactor(index: number): number {
  return 0.9 + 0.12 * hash01(index, 101);
}

/** The output factor an inverter state leaves to the panels. */
export function statusFactor(status: string): number {
  return status === "degraded" ? DEGRADED_OUTPUT : 1;
}

/**
 * Local weather: a site sees a little more or less sun than the region on a
 * given day, so two sites never move in lockstep.
 */
function localSky(site: SiteProfile, ms: number): number {
  return 0.88 + 0.24 * hash01(site.index, Math.floor(ms / DAY_MS), 7);
}

function isActive(site: SiteProfile, ms: number): boolean {
  return ms >= site.activeFrom && ms <= site.activeUntil;
}

/**
 * What a site's inverter reads at `ms`, in kW, report jitter included. A small,
 * deterministic photovoltaic model: production is a pure function of the
 * instant, made of the sun's course over Liège (day length and peak by
 * season), the day's weather and passing clouds (hashed from the date, so
 * every request and every machine sees the same sky), and each site's own
 * factor (orientation, a degraded inverter, an inverter gone silent). No
 * telemetry is stored: any period can be recomputed, and the simulator only
 * has to say "new readings" for the page to move.
 */
export function sitePowerKw(site: SiteProfile, ms: number): number {
  if (!isActive(site, ms)) return 0;
  const report = Math.floor(ms / REPORT_INTERVAL_MS);
  const jitter = 0.97 + 0.06 * hash01(site.index, report);
  return (
    site.capacityKwp *
    site.factor *
    localSky(site, ms) *
    irradiance(ms) *
    jitter
  );
}

/**
 * Sampling step for integrating a bucket: fine enough for the curve, few
 * enough samples to answer a 90-day range at once.
 */
function sampleStep(spanMs: number): number {
  if (spanMs <= HOUR_MS) return 5 * MINUTE_MS;
  if (spanMs <= 6 * HOUR_MS) return 15 * MINUTE_MS;
  return 30 * MINUTE_MS;
}

/**
 * Energy the given sites produce between `from` and `to` (capped at `now`),
 * in kWh. Readings are averaged, so no report jitter.
 */
export function energyKwh(
  sites: readonly SiteProfile[],
  from: number,
  to: number,
  now: number,
): number {
  const end = Math.min(to, now);
  if (end <= from) return 0;
  const step = sampleStep(to - from);
  let total = 0;
  for (let at = from; at < end; at += step) {
    const slice = Math.min(step, end - at);
    const middle = at + slice / 2;
    const sun = irradiance(middle);
    if (sun === 0) continue;
    let kwp = 0;
    for (const site of sites) {
      if (!isActive(site, middle)) continue;
      kwp += site.capacityKwp * site.factor * localSky(site, middle);
    }
    total += kwp * sun * (slice / HOUR_MS);
  }
  return total;
}
