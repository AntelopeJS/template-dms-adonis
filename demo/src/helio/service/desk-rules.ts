import { findCustomerFacts } from "../projects/crm-facts";
import { teamIdsByRole } from "../shared/roster";
import type { Rng } from "../shared/seed";
import { regionOfProvince, techniciansOf } from "../team/regions";
import type { TicketCategory, TicketChannel, TicketPriority } from "./database";

const TECHNICIANS = teamIdsByRole("technician");
const OFFICE = teamIdsByRole("office");
/**
 * The after-sales specialists (remote diagnostics, storage and monitoring),
 * who take a larger share of the technical tickets than the roofers.
 */
const SERVICE_SPECIALISTS = new Set(["team-06", "team-09"]);

const TECHNICAL: readonly TicketCategory[] = [
  "no_production",
  "inverter_error",
  "monitoring",
  "damage",
];

/** Whether a ticket needs a technician rather than the office. */
export function isTechnical(category: TicketCategory): boolean {
  return TECHNICAL.includes(category);
}

/** Monday to Friday, 8:00 to 18:00: the hours the office answers. */
export function isBusinessHours(date: Date): boolean {
  const day = date.getDay();
  const hour = date.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

/**
 * How likely a ticket of this channel arrives at that moment, from 0 to 1.
 * Inverters raise alerts while they produce (daylight) and rarely at night;
 * the phone line is staffed on weekdays, with a Saturday-morning on-call;
 * customers write by e-mail or through the portal mostly during the day,
 * some in the evening and at weekends.
 */
export function slotWeight(channel: TicketChannel, date: Date): number {
  const hour = date.getHours();
  const day = date.getDay();
  const weekday = day >= 1 && day <= 5;
  const daytime = hour >= 8 && hour < 18;
  if (channel === "monitoring_alert") return daytime ? 1 : 0.15;
  if (channel === "phone") {
    if (weekday && daytime) return hour === 12 ? 0.4 : 1;
    return day === 6 && hour >= 9 && hour < 12 ? 0.3 : 0;
  }
  if (weekday && daytime) return 1;
  if (weekday && hour >= 18 && hour < 22) return 0.35;
  return !weekday && hour >= 9 && hour < 20 ? 0.2 : 0;
}

/**
 * A moment between `from` and `to` (epoch ms) when this channel brings
 * tickets in. Falls back to `to` when the window holds no such moment (a
 * phone call asked for a Sunday): the caller's window then wins.
 */
export function sampleArrival(
  rng: Rng,
  channel: TicketChannel,
  from: number,
  to: number,
): Date {
  for (let attempt = 0; attempt < 80; attempt++) {
    const date = new Date(from + rng.next() * (to - from));
    if (rng.next() < slotWeight(channel, date)) return date;
  }
  return new Date(to);
}

export function pickCategory(rng: Rng): TicketCategory {
  return rng.weighted<TicketCategory>([
    ["no_production", 12],
    ["inverter_error", 22],
    ["monitoring", 20],
    ["damage", 6],
    ["billing", 24],
    ["other", 16],
  ]);
}

export function channelFor(rng: Rng, category: TicketCategory): TicketChannel {
  if (category === "inverter_error" || category === "no_production") {
    return rng.weighted<TicketChannel>([
      ["monitoring_alert", 5],
      ["phone", 3],
      ["email", 1],
      ["portal", 1],
    ]);
  }
  if (category === "monitoring")
    return rng.weighted<TicketChannel>([
      ["monitoring_alert", 3],
      ["portal", 2],
      ["email", 2],
    ]);
  return rng.weighted<TicketChannel>([
    ["email", 4],
    ["phone", 3],
    ["portal", 3],
  ]);
}

/**
 * A priority drawn for the category. A billing or general question is never
 * urgent; a technical one can be, except a monitoring one.
 */
export function priorityFor(
  rng: Rng,
  category: TicketCategory,
): TicketPriority {
  if (!isTechnical(category))
    return rng.weighted<TicketPriority>([
      ["low", 4],
      ["normal", 5],
      ["high", 1],
    ]);
  return rng.weighted<TicketPriority>([
    ["low", 2],
    ["normal", 5],
    ["high", 3],
    ["urgent", category === "monitoring" ? 0 : 1],
  ]);
}

/**
 * The technician a technical ticket goes to: one of the customer's region
 * first, the after-sales specialists next. `load` (open tickets held, by
 * member) steers a live desk towards whoever holds the fewest. A customer
 * created since the seed has no known province and gets the Liège region.
 */
export function technicianFor(
  rng: Rng,
  customerId: string,
  load?: ReadonlyMap<string, number>,
): string {
  const province = findCustomerFacts(customerId)?.address.countrySubdivision;
  const local = new Set(techniciansOf(regionOfProvince(province)));
  return rng.weighted(
    TECHNICIANS.map((id) => {
      const affinity = local.has(id) ? 4 : SERVICE_SPECIALISTS.has(id) ? 2 : 1;
      return [id, affinity / (1 + (load?.get(id) ?? 0))] as const;
    }),
  );
}

/**
 * Who a ticket goes to, by its category: a technician for a technical
 * request, the office for a billing or general question. The seed and the
 * simulator both use it, so they tell the same story.
 */
export function assigneeFor(
  rng: Rng,
  category: TicketCategory,
  customerId: string,
  load?: ReadonlyMap<string, number>,
): string {
  if (isTechnical(category)) return technicianFor(rng, customerId, load);
  return rng.weighted(
    OFFICE.map((id) => [id, 1 / (1 + (load?.get(id) ?? 0))] as const),
  );
}
