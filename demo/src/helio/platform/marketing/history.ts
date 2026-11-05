import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type {
  MarketingAnalyticsImport,
  MarketingImportSession,
} from "@antelopejs/interface-dms-marketing";
import { createRng, DAY_MS, type Rng } from "../../shared/seed";
import {
  acquire,
  CAMPAIGNS,
  channelWeights,
  newVisitor,
  type Visitor,
} from "./audience";
import { buildVisit } from "./journeys";
import { WEBSITE_ID } from "./site";

const HISTORY_DAYS = 84;
const DAYS_PER_IMPORT = 28;
const HOUR_MS = 60 * 60 * 1000;
/** Brussels is UTC+2 in summer time, which the whole window falls in. */
const BRUSSELS_OFFSET_HOURS = 2;
const RETURNING_SHARE = 0.24;
const RECENT_VISITORS = 600;
const SEED = 20_261_017;

/** Relative weight of each local hour of the day: a lunch peak, then evenings after work. */
const HOUR_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0.5],
  [6, 1],
  [7, 3],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 7],
  [12, 9],
  [13, 8],
  [14, 6],
  [15, 6],
  [16, 6],
  [17, 7],
  [18, 8],
  [19, 10],
  [20, 11],
  [21, 10],
  [22, 6],
  [23, 3],
];

/** Visits on a given day before now: weekday rhythm, season, campaigns. */
function visitsOn(rng: Rng, day: number, weekday: number): number {
  const weekend = weekday === 0 || weekday === 6 ? 0.72 : 1;
  const season = 1 + ((HISTORY_DAYS - day) / HISTORY_DAYS) * 0.22;
  const campaign = day <= CAMPAIGNS.autumnBattery.start ? 26 : 0;
  const newsletter = CAMPAIGNS.newsletters.some((n) => day === n.day) ? 70 : 0;
  const fair =
    day <= CAMPAIGNS.fair.start && day >= CAMPAIGNS.fair.end ? 22 : 0;
  return Math.round(
    (118 * season + campaign) * weekend * (0.88 + rng.next() * 0.24) +
      newsletter +
      fair,
  );
}

class VisitorPool {
  private readonly recent: Visitor[] = [];
  private count = 0;

  constructor(private readonly rng: Rng) {}

  next(): Visitor {
    if (this.recent.length > 20 && this.rng.chance(RETURNING_SHARE)) {
      return this.rng.pick(this.recent);
    }
    this.count += 1;
    const visitor = newVisitor(this.rng, this.count);
    this.recent.push(visitor);
    if (this.recent.length > RECENT_VISITORS) this.recent.shift();
    return visitor;
  }
}

function startOfUtcDay(at: number): number {
  return Math.floor(at / DAY_MS) * DAY_MS;
}

/**
 * The sessions of one day before now. Today stops at the boot, so no visit is
 * dated in the future.
 */
function sessionsOfDay(
  rng: Rng,
  pool: VisitorPool,
  day: number,
  now: number,
): MarketingImportSession[] {
  const midnight = startOfUtcDay(now) - day * DAY_MS;
  const sessions: MarketingImportSession[] = [];
  const total = visitsOn(rng, day, new Date(midnight).getUTCDay());
  for (let i = 0; i < total; i++) {
    const hour = rng.weighted(HOUR_WEIGHTS);
    const start =
      midnight +
      (hour - BRUSSELS_OFFSET_HOURS) * HOUR_MS +
      rng.int(0, 3599) * 1000;
    if (start >= now - 5 * 60 * 1000) continue;
    const visitor = pool.next();
    const acquisition = acquire(rng, rng.weighted(channelWeights(day)), day);
    const events = buildVisit({ rng, visitor, acquisition, start, now });
    if (events.length === 0) continue;
    sessions.push({
      visitor: visitor.key,
      userAgent: visitor.device.userAgent,
      country: visitor.country,
      screen: visitor.screen,
      language: visitor.language,
      events,
    });
  }
  return sessions;
}

/**
 * Twelve weeks of traffic history for the website, dated back from the boot
 * that first imports it, as the imports to send in order: a weekly rhythm, a
 * slow seasonal rise, peaks on the newsletter days and at the Namur fair, and
 * the autumn battery campaign lifting paid traffic over the last weeks. It is
 * split into imports of four weeks each, well under the 10,000 sessions a call
 * accepts.
 */
export function historyImports(now: number): MarketingAnalyticsImport[] {
  const rng = createRng(SEED);
  const pool = new VisitorPool(rng);
  const imports: MarketingAnalyticsImport[] = [];
  for (let first = HISTORY_DAYS - 1; first >= 0; first -= DAYS_PER_IMPORT) {
    const sessions: MarketingImportSession[] = [];
    for (let day = first; day > first - DAYS_PER_IMPORT && day >= 0; day--) {
      sessions.push(...sessionsOfDay(rng, pool, day, now));
    }
    imports.push({
      tenantId: DEFAULT_TENANT_ID,
      importId: `helio-website-history-${imports.length + 1}`,
      websiteId: WEBSITE_ID,
      sessions,
    });
  }
  return imports;
}
