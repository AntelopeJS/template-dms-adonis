import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { Ticket } from "./database";
import { helioNow } from "../shared/clock";

const HOUR_MS = 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * HOUR_MS;

/** Links of the cells to the desk's views, given by the page. */
export interface ServiceStatLinks {
  open: string;
  urgent: string;
  breaching: string;
  resolved: string;
}

/** A count cell value, formatted by the stat group. */
const count = (value: number) => ({ type: "count", value }) as const;

/** Average hours from creation to resolution of the tickets resolved in the last 30 days, or 0 when there are none. */
function averageResolutionHours(tickets: Ticket[], now: number): number {
  const durations = tickets
    .filter(
      (ticket) =>
        ticket.resolvedAt && now - ticket.resolvedAt.getTime() <= MONTH_MS,
    )
    .map(
      (ticket) =>
        (ticket.resolvedAt?.getTime() ?? 0) - ticket.createdAt.getTime(),
    );
  if (durations.length === 0) return 0;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return total / durations.length / HOUR_MS;
}

/**
 * The four cells of the desk's stat group: how many tickets are open, how many
 * are urgent or past their SLA, and how fast the last month's tickets were
 * resolved. The SLA is the promised resolution time: an open ticket past it
 * breaches it, assigned or not. Computed from the tickets on each read, which
 * is fine for the few hundred rows of the demo.
 */
export function serviceStats(
  tickets: Ticket[],
  links: ServiceStatLinks,
  urgentHours: number,
  now = helioNow(),
): StatGroupItem[] {
  const open = tickets.filter((ticket) => !ticket.resolvedAt);
  const unassigned = open.filter((ticket) => !ticket.assignee).length;
  const urgent = open.filter((ticket) => ticket.priority === "urgent");
  const breaching = open.filter((ticket) => ticket.slaDueAt.getTime() < now);
  const fresh = open.filter((ticket) => ticket.status === "new").length;
  const hours = averageResolutionHours(tickets, now);
  return [
    {
      id: "open",
      icon: "i-ph-tray",
      tone: "primary",
      eyebrow: "$helio.service.stats.open",
      value: open.length,
      detail: {
        key: "$helio.service.stats.openDetail",
        params: { fresh: count(fresh), unassigned },
      },
      to: links.open,
    },
    {
      id: "urgent",
      icon: "i-ph-fire",
      tone: urgent.length > 0 ? "error" : "success",
      eyebrow: "$helio.service.stats.urgent",
      value: urgent.length,
      detail: {
        key: "$helio.service.stats.urgentDetail",
        params: { hours: count(urgentHours) },
      },
      detailTone: urgent.length > 0 ? "error" : "neutral",
      to: links.urgent,
    },
    {
      id: "breaching",
      icon: "i-ph-alarm",
      tone: breaching.length > 0 ? "warning" : "success",
      eyebrow: "$helio.service.stats.breaching",
      value: breaching.length,
      detail: "$helio.service.stats.breachingDetail",
      detailTone: breaching.length > 0 ? "warning" : "neutral",
      to: links.breaching,
    },
    {
      id: "resolution",
      icon: "i-ph-timer",
      tone: "info",
      eyebrow: "$helio.service.stats.resolution",
      value: {
        key: "$helio.service.stats.resolutionValue",
        params: {
          hours: { type: "number", value: Math.round(hours * 10) / 10 },
        },
      },
      detail: "$helio.service.stats.resolutionDetail",
      to: links.resolved,
    },
  ];
}
