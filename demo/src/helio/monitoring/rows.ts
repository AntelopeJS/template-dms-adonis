import type { CellSubline } from "@antelopejs/interface-dms/base/table-view";
import type { ComposedText } from "@antelopejs/interface-dms/base/types";
import { sparkline } from "./charts";
import { currentPowerKw, type FleetSite, lastSeenAt, round1 } from "./fleet";
import { type Period, startOfLocalDay } from "./period";
import { energyKwh } from "./solar";

const FILTERABLE = ["inverterStatus", "city"] as const;

export interface SiteRow {
  _id: string;
  name: string;
  city: string;
  customerName: string;
  project: string;
  inverterStatus: FleetSite["status"];
  statusDetail: CellSubline | null;
  capacityKwp: number;
  powerKw: number;
  /** "15.7 kW" over "12 % of peak": the power column's two lines. */
  powerLabel: ComposedText;
  powerShare: ComposedText;
  capacityLabel: ComposedText;
  periodKwh: number;
  periodLabel: ComposedText;
  /** The period's energy again, under the sparkline column (sorting unused). */
  periodTrend: number;
  trend: number[];
  todayKwh: number;
  todayLabel: ComposedText;
  lastSeenAt: string;
}

/** `"1 712,2 kWh"`: grouped digits and the unit, in the reader's locale. */
function quantity(key: string, value: number): ComposedText {
  return { key, params: { value: { type: "number", value } } };
}

/** What the pill says under an inverter that needs someone. */
function statusDetail(site: FleetSite): CellSubline | null {
  if (site.status === "degraded") {
    return { text: "$helio.monitoring.table.degradedDetail", tone: "warning" };
  }
  if (site.status === "offline") {
    return {
      text: {
        key: "$helio.monitoring.table.offlineDetail",
        params: { since: { type: "relative", value: site.storedLastSeen } },
      },
      tone: "error",
    };
  }
  return null;
}

/** The row of one site: its live reading and what it produced over the period. */
export function siteRow(site: FleetSite, period: Period, now: number): SiteRow {
  const power = currentPowerKw(site, now);
  const periodKwh = round1(energyKwh([site], period.from, period.to, now));
  const todayKwh = round1(energyKwh([site], startOfLocalDay(now), now, now));
  return {
    _id: site.id,
    name: site.name,
    city: site.city,
    customerName: site.customerName,
    project: site.project ?? "",
    inverterStatus: site.status,
    statusDetail: statusDetail(site),
    capacityKwp: site.capacityKwp,
    capacityLabel: quantity(
      "$helio.monitoring.units.kwpValue",
      site.capacityKwp,
    ),
    powerKw: power,
    powerLabel: quantity("$helio.monitoring.units.kwValue", power),
    powerShare: {
      key: "$helio.monitoring.table.powerShare",
      params: {
        share: {
          type: "number",
          value: Math.round((power / site.capacityKwp) * 100) / 100,
          format: "percent",
        },
      },
    },
    periodKwh,
    periodLabel: quantity("$helio.monitoring.units.kwhValue", periodKwh),
    periodTrend: periodKwh,
    trend: sparkline(site, period, now),
    todayKwh,
    todayLabel: quantity("$helio.monitoring.units.kwhValue", todayKwh),
    lastSeenAt: new Date(lastSeenAt(site, now)).toISOString(),
  };
}

/**
 * Applies the `filter_<column>=is:<value>` parameters the table sends from its
 * tabs and quick filters: `filter_inverterStatus=is:offline` keeps the offline
 * sites. Only `is` is offered, the column filters are off.
 */
function matches(site: FleetSite, query: URLSearchParams): boolean {
  return FILTERABLE.every((field) => {
    const filter = query.get(`filter_${field}`);
    if (!filter) return true;
    const value = filter.replace(/^is:/, "");
    const actual = field === "city" ? site.city : site.status;
    return value.split(",").includes(actual);
  });
}

/** The rows the table lists for this query, every one (no paging). */
export function siteRows(
  sites: readonly FleetSite[],
  query: URLSearchParams,
  period: Period,
  now: number,
) {
  const results = sites
    .filter((site) => matches(site, query))
    .map((site) => siteRow(site, period, now));
  return { results, total: results.length };
}
