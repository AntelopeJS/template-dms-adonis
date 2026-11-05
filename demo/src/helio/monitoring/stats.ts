import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { ComposedText } from "@antelopejs/interface-dms/base/types";
import {
  capacityOf,
  currentPowerKw,
  type FleetSite,
  lastSeenAt,
  round1,
} from "./fleet";
import { MONITORING_PAGE_PATH } from "./links";
import { startOfLocalDay } from "./period";
import { DEGRADED_OUTPUT, energyKwh } from "./solar";

/** A Belgian household uses about 3,500 kWh a year. */
const HOUSEHOLD_DAILY_KWH = 9.6;

const decimal = (value: number) => ({ type: "number", value }) as const;
const count = (value: number) => ({ type: "count", value }) as const;
const percent = (value: number) =>
  ({ type: "number", value, format: "percent" }) as const;

const kw = (value: number): ComposedText => ({
  key: "$helio.monitoring.units.kwValue",
  params: { value: decimal(round1(value)) },
});
const kwp = (value: number): ComposedText => ({
  key: "$helio.monitoring.units.kwpValue",
  params: { value: decimal(round1(value)) },
});
const kwh = (value: number): ComposedText => ({
  key: "$helio.monitoring.units.kwhValue",
  params: { value: decimal(Math.round(value)) },
});

function fleetPowerKw(sites: readonly FleetSite[], now: number): number {
  return round1(
    sites.reduce((sum, site) => sum + currentPowerKw(site, now), 0),
  );
}

function byStatus(sites: readonly FleetSite[], status: FleetSite["status"]) {
  return sites.filter((site) => site.status === status);
}

function sitesItem(sites: readonly FleetSite[]): StatGroupItem {
  const offline = byStatus(sites, "offline").length;
  const degraded = byStatus(sites, "degraded").length;
  const online = sites.length - offline - degraded;
  return {
    id: "sites",
    icon: offline > 0 ? "i-ph-wifi-slash" : "i-ph-wifi-high",
    tone: offline > 0 ? "warning" : "success",
    eyebrow: "$helio.monitoring.stats.sites",
    value: {
      key: "$helio.monitoring.stats.sitesValue",
      params: { online, total: sites.length },
    },
    detail: {
      key: "$helio.monitoring.stats.sitesDetail",
      params: {
        degraded: {
          key: "$helio.monitoring.stats.degradedCount",
          params: { count: { type: "count", value: degraded } },
        },
        offline: {
          key: "$helio.monitoring.stats.offlineCount",
          params: { count: { type: "count", value: offline } },
        },
      },
    },
    detailTone: offline > 0 ? "warning" : "neutral",
    to: `${MONITORING_PAGE_PATH}?table.tab=offline`,
  };
}

/**
 * The stat strip: capacity, output now, energy today and the sites' state. The
 * fleet's figures here, the meters and the site drawer read the instant, not
 * the period.
 */
export function fleetStats(sites: readonly FleetSite[], now: number) {
  const capacity = capacityOf(sites);
  const power = fleetPowerKw(sites, now);
  const today = energyKwh(sites, startOfLocalDay(now), now, now);
  return {
    items: [
      {
        id: "capacity",
        icon: "i-ph-solar-panel",
        eyebrow: "$helio.monitoring.stats.capacity",
        value: kwp(capacity),
        detail: {
          key: "$helio.monitoring.stats.capacityDetail",
          params: { count: count(sites.length) },
        },
      },
      {
        id: "power",
        icon: "i-ph-lightning",
        tone: "warning",
        eyebrow: "$helio.monitoring.stats.power",
        value: kw(power),
        detail: {
          key: "$helio.monitoring.stats.powerDetail",
          params: {
            share: percent(
              capacity > 0 ? Math.round((power / capacity) * 100) / 100 : 0,
            ),
          },
        },
      },
      {
        id: "today",
        icon: "i-ph-sun",
        tone: "warning",
        eyebrow: "$helio.monitoring.stats.today",
        value: kwh(today),
        detail: {
          key: "$helio.monitoring.stats.todayDetail",
          params: { count: count(Math.round(today / HOUSEHOLD_DAILY_KWH)) },
        },
      },
      sitesItem(sites),
    ],
  } satisfies { items: StatGroupItem[] };
}

export interface MeterPayload {
  value: number;
  max: number;
  hint: ComposedText;
}

/** Output now against the installed peak power. */
export function capacityMeter(
  sites: readonly FleetSite[],
  now: number,
): MeterPayload {
  const power = fleetPowerKw(sites, now);
  const capacity = capacityOf(sites);
  return {
    value: power,
    max: capacity,
    hint: {
      key: "$helio.monitoring.meters.outputHint",
      params: { power: decimal(power), capacity: decimal(capacity) },
    },
  };
}

/**
 * The peak power faults take from the fleet: what degraded inverters fail to
 * deliver plus every offline site. Past 5 % of the fleet it reads warning,
 * past 15 % error.
 */
export function lostCapacityMeter(sites: readonly FleetSite[]): MeterPayload {
  const degraded = byStatus(sites, "degraded");
  const offline = byStatus(sites, "offline");
  const lost =
    capacityOf(degraded) * (1 - DEGRADED_OUTPUT) + capacityOf(offline);
  return {
    value: round1(lost),
    max: capacityOf(sites),
    hint: {
      key: "$helio.monitoring.meters.attentionHint",
      params: {
        degraded: decimal(capacityOf(degraded)),
        offline: decimal(capacityOf(offline)),
      },
    },
  };
}

/** What the drawer of a site reads: one record, its figures as numbers. */
export interface SiteRecord {
  _id: string;
  name: string;
  customer: string;
  city: string;
  commissionedAt: string;
  project: string | null;
  status: FleetSite["status"];
  /** Milliseconds since the inverter last reported. */
  sinceLastReport: number;
  capacityKwp: number;
  powerKw: number;
  todayKwh: number;
  yieldKwhPerKwp: number;
}

/**
 * The facts of one site, for its drawer: a read-only form, which draws each
 * value through its field's type (the units are the fields' suffixes).
 * `projectCode` names the site's project, when it has one.
 */
export function siteRecord(
  site: FleetSite,
  now: number,
  projectCode: string | null,
): SiteRecord {
  const today = energyKwh([site], startOfLocalDay(now), now, now);
  return {
    _id: site.id,
    name: site.name,
    customer: site.customerName,
    city: site.city,
    commissionedAt: new Date(site.activeFrom).toISOString(),
    project: projectCode,
    status: site.status,
    sinceLastReport: Math.max(0, now - lastSeenAt(site, now)),
    capacityKwp: round1(site.capacityKwp),
    powerKw: round1(currentPowerKw(site, now)),
    todayKwh: Math.round(today),
    yieldKwhPerKwp: round1(today / site.capacityKwp),
  };
}
