import { addWorkdays } from "../projects/calendar";
import { type ProjectPlan, projectPlans } from "../projects/plan";
import { COUNTS, siteId } from "../shared/roster";
import { createRng, DAY_MS, type Rng } from "../shared/seed";
import type { InverterStatus, Site } from "./database";
import { helioNow } from "../shared/clock";

export type SiteSeed = Pick<
  Site,
  | "_id"
  | "name"
  | "customer"
  | "project"
  | "city"
  | "capacityKwp"
  | "inverterStatus"
  | "commissionedAt"
  | "todayKwh"
  | "last7Days"
  | "lastSeenAt"
>;

const MINUTE_MS = 60 * 1000;

/**
 * Sites 7 and 23 are down, so the fleet page and the service desk both have
 * something to show.
 */
const OFFLINE = new Set([7, 23]);
/** Four more sites run degraded. */
const DEGRADED = new Set([3, 12, 19, 31]);

/**
 * kWh per kWp over the last seven days, oldest first: a grey Belgian October
 * with one sunny spell, shared by every site so the sparklines of the fleet
 * move together.
 */
const WEATHER = [1.4, 0.9, 2.1, 2.6, 1.7, 0.6, 1.9];
/** kWh per kWp so far today. */
const TODAY = 1.2;

function statusOf(index: number): InverterStatus {
  if (OFFLINE.has(index)) return "offline";
  return DEGRADED.has(index) ? "degraded" : "online";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A degraded inverter loses output over the week; an offline one stopped
 * reporting one to three days ago.
 */
function production(rng: Rng, capacity: number, status: InverterStatus) {
  const silentDays = status === "offline" ? rng.int(1, 3) : 0;
  const last7Days = WEATHER.map((factor, day) => {
    if (day >= WEATHER.length - silentDays) return 0;
    const wear = status === "degraded" ? 1 - day * 0.07 : 1;
    return round1(capacity * factor * wear * (0.9 + rng.next() * 0.2));
  });
  const todayKwh =
    status === "offline"
      ? 0
      : round1(capacity * TODAY * (status === "degraded" ? 0.5 : 1));
  return { last7Days, todayKwh, silentDays };
}

function lastSeen(rng: Rng, status: InverterStatus, silentDays: number): Date {
  const now = helioNow();
  if (status === "offline")
    return new Date(now - silentDays * DAY_MS - rng.int(60, 600) * MINUTE_MS);
  return new Date(
    now -
      rng.int(status === "degraded" ? 5 : 0, status === "degraded" ? 40 : 10) *
        MINUTE_MS,
  );
}

function siteName(plan: ProjectPlan): string {
  const kind = plan.type === "commercial_pv" ? "Centrale" : "Toiture";
  return `${kind} ${plan.customer.name}`;
}

/**
 * The seed of one site. It is commissioned with the grid operator a few
 * working days after the work.
 */
function toSite(rng: Rng, plan: ProjectPlan, index: number): SiteSeed {
  const status = statusOf(index);
  const { last7Days, todayKwh, silentDays } = production(
    rng,
    plan.capacityKwp,
    status,
  );
  return {
    _id: siteId(index),
    name: siteName(plan),
    customer: plan.customer._id,
    project: plan.projectId,
    city: plan.customer.address.city,
    capacityKwp: plan.capacityKwp,
    inverterStatus: status,
    commissionedAt: addWorkdays(plan.end, rng.int(1, 3)),
    todayKwh,
    last7Days,
    lastSeenAt: lastSeen(rng, status, silentDays),
  };
}

/** The finished solar projects that became monitored sites, oldest first. */
export function monitoredProjects(): ProjectPlan[] {
  return projectPlans()
    .filter((plan) => plan.status === "done" && plan.capacityKwp > 0)
    .slice(0, COUNTS.sites);
}

let sites: SiteSeed[] | undefined;

/**
 * The 40 sites, `site-01` ... `site-40`: the solar installations Helio
 * monitors, one per finished solar project. Production follows a shared
 * autumn weather pattern, with a few degraded inverters and two sites gone
 * offline.
 */
export function buildSites(): SiteSeed[] {
  if (!sites) {
    const rng = createRng(0x9e110005);
    sites = distinctNames(
      monitoredProjects().map((plan, at) => toSite(rng, plan, at + 1)),
    );
  }
  return sites;
}

/**
 * A customer with a second installation (another building, an annex) must not
 * show two identical lines in the fleet table.
 */
function distinctNames(seeds: SiteSeed[]): SiteSeed[] {
  const seen = new Map<string, number>();
  return seeds.map((site) => {
    const count = (seen.get(site.name) ?? 0) + 1;
    seen.set(site.name, count);
    if (count === 1) return site;
    const suffix = site.name.startsWith("Centrale")
      ? `bâtiment ${count}`
      : count === 2
        ? "annexe"
        : `annexe ${count - 1}`;
    return { ...site, name: `${site.name} · ${suffix}` };
  });
}
