import type { QuoteLine } from "../sales/database";
import {
  buildLines,
  fitPvLines,
  type InstallationType,
  VAT_BUSINESS,
  VAT_RESIDENTIAL,
} from "../sales/lines";
import { COUNTS, dealId, projectId, quoteId } from "../shared/roster";
import { createRng, DAY_MS, type Rng } from "../shared/seed";
import {
  addWorkdays,
  atHour,
  dayAt,
  isWorkday,
  nextWorkday,
  previousWorkday,
  seasonalWorkdays,
  workdayBetween,
} from "./calendar";
import { type Crew, CrewPlanner, type CrewRequest } from "./crews";
import {
  activeCustomers,
  type CustomerFacts,
  customerFacts,
  dealFacts,
  isBusiness,
} from "./crm-facts";
import type { ProjectStatus } from "./database";
import { helioNow } from "../shared/clock";

/**
 * The backbone every operations fixture hangs on: one entry per installation
 * project, built from an accepted quote. Quotes (sales), projects and their
 * tasks, monitored sites, invoices and the activity feed all read this plan,
 * so a won deal, its signed quote, the project on site, the invoices and the
 * finished installation always tell the same story.
 */
export interface ProjectPlan {
  /** 1-based, shared by the project and its accepted quote. */
  index: number;
  projectId: string;
  quoteId: string;
  /** The won deal the quote closed, for half of the projects. */
  dealId?: string;
  customer: CustomerFacts;
  type: InstallationType;
  status: ProjectStatus;
  start: Date;
  end: Date;
  signedAt: Date;
  lines: QuoteLine[];
  capacityKwp: number;
  vatRate: number;
  leadTechnician: string;
  crew: string[];
}

/**
 * How many projects stand in each status, oldest first: the finished ones
 * spread over the past year, a few installed and waiting for the electrical
 * inspection, two sites running now (the after-sales technician stays on the
 * service desk), the coming weeks booked, the next months planned, a few
 * paused.
 */
const STATUS_COUNTS: ReadonlyArray<readonly [ProjectStatus, number]> = [
  ["done", 51],
  ["inspection", 4],
  ["in_progress", 2],
  ["scheduled", 10],
  ["planned", 8],
  ["on_hold", 5],
];
/** The number of finished projects in `STATUS_COUNTS`. */
const DONE_COUNT = 51;

/** The status of the project at `index`, so the planning and the kanban have every column. */
function statusOf(index: number): ProjectStatus {
  let last = 0;
  for (const [status, count] of STATUS_COUNTS) {
    last += count;
    if (index <= last) return status;
  }
  return "on_hold";
}

/**
 * How many of the booked projects start soon. The first ones that are direct
 * orders (even indexes: no deal pushes their start back) start within the
 * coming working week, so the planning and the "This week" view always open on
 * a site to prepare.
 */
const SOON_STARTS = 2;

/** How many working days after the next one a project that starts soon may start. */
const SOON_WORKDAYS = 4;

/** Whether the project is one of the booked ones that start within the week. */
function startsSoon(index: number): boolean {
  if (statusOf(index) !== "scheduled" || index % 2 === 1) return false;
  let first = 1;
  while (statusOf(first) !== "scheduled") first += 1;
  const evenFirst = first % 2 === 0 ? first : first + 1;
  return index < evenFirst + SOON_STARTS * 2;
}

/**
 * The customer of the project at `index`. Half of the projects come from the 40
 * won deals (odd indexes); the others are direct orders from existing
 * customers (a battery, a charger, a roof).
 */
function customerOf(
  rng: Rng,
  index: number,
): Pick<ProjectPlan, "customer" | "dealId"> {
  if (index % 2 === 1) {
    const deal = dealFacts(dealId((index + 1) / 2));
    return { customer: customerFacts(deal.customer), dealId: deal._id };
  }
  return { customer: rng.pick(activeCustomers()) };
}

/**
 * The installation type of the project at `index`. Finished projects are
 * nearly all solar arrays, so 40 of them can become monitored sites; the open
 * ones mix in batteries and chargers. A site being installed right now spans
 * several days, so it is a solar array, and so is a project from a won deal,
 * which always sold one (its title says how many kWc).
 */
function typeOf(
  rng: Rng,
  index: number,
  business: boolean,
  fromDeal: boolean,
): InstallationType {
  const pv: InstallationType = business ? "commercial_pv" : "residential_pv";
  const status = statusOf(index);
  if (status === "done") {
    if (index % 8 !== 0) return pv;
    return business
      ? "ev_charger"
      : rng.pick(["battery", "ev_charger"] as const);
  }
  if (fromDeal || status === "in_progress") return pv;
  if (business) return rng.chance(0.5) ? pv : "ev_charger";
  return rng.weighted<InstallationType>([
    ["residential_pv", 45],
    ["battery", 35],
    ["ev_charger", 20],
  ]);
}

/** Working days on site. */
function workdays(rng: Rng, type: InstallationType, business: boolean): number {
  switch (type) {
    case "residential_pv":
      return rng.int(2, 3);
    case "commercial_pv":
      return rng.int(6, 14);
    case "battery":
      return 1;
    case "ev_charger":
      return business ? rng.int(2, 3) : 1;
  }
}

/** The first and last day of an installation. */
interface Dates {
  start: Date;
  end: Date;
}

/** The dates of an installation of `days` working days from `start`. */
const span = (start: Date, days: number): Dates => ({
  start,
  end: addWorkdays(start, days - 1),
});

/**
 * The first working day still ahead: today on a weekday before the crews
 * leave, else the next one.
 */
function nextWorkingDay(): Date {
  const today = dayAt(0);
  const late = new Date(helioNow()).getHours() >= 17;
  return isWorkday(today) && !late ? today : addWorkdays(today, 1);
}

/**
 * The dates of a project that is not one of the finished ones, by status. A
 * project on site started before the next working day and is still running on
 * it.
 */
function currentDates(
  rng: Rng,
  status: ProjectStatus,
  days: number,
  soon: boolean,
): Dates {
  if (soon) {
    return span(addWorkdays(nextWorkingDay(), rng.int(0, SOON_WORKDAYS)), days);
  }
  switch (status) {
    case "inspection": {
      const end = previousWorkday(dayAt(-rng.int(2, 9)));
      return { start: addWorkdays(end, -(days - 1)), end };
    }
    case "in_progress": {
      const next = nextWorkingDay();
      const start = addWorkdays(next, -rng.int(1, Math.min(days - 1, 6)));
      return span(start, days);
    }
    case "scheduled":
      return span(addWorkdays(nextWorkingDay(), rng.int(3, 30)), days);
    case "planned":
      return span(workdayBetween(rng, 45, 110), days);
    default:
      return span(workdayBetween(rng, -60, 40), days);
  }
}

/**
 * The earliest start of a project from a won deal: the deal's quote is signed
 * the day the deal closed, and the work never starts within a week of it.
 */
function earliestStart(deal?: string): Date | undefined {
  if (!deal) return undefined;
  const closedDays = Math.ceil(
    (dealFacts(deal).expectedClose.getTime() - helioNow()) / DAY_MS,
  );
  return nextWorkday(dayAt(closedDays + 7));
}

/** A project whose dates are chosen and whose crew is not yet. */
interface Draft {
  index: number;
  status: ProjectStatus;
  type: InstallationType;
  customer: CustomerFacts;
  dealId?: string;
  dates: Dates;
  days: number;
  earliest?: Date;
}

/** The draft of the project at `index`; `doneStart` is the start of a finished one. */
function draftProject(rng: Rng, index: number, doneStart?: Date): Draft {
  const { customer, dealId: deal } = customerOf(rng, index);
  const business = isBusiness(customer);
  const type = typeOf(rng, index, business, deal !== undefined);
  const status = statusOf(index);
  const days = workdays(rng, type, business);
  const planned = doneStart
    ? span(doneStart, days)
    : currentDates(rng, status, days, startsSoon(index));
  const earliest = earliestStart(deal);
  const dates =
    earliest && planned.start < earliest ? span(earliest, days) : planned;
  return { index, status, type, customer, dealId: deal, dates, days, earliest };
}

/**
 * The plan of a draft once crewed. A direct order is signed a few weeks before
 * its start, never today.
 */
function toPlan(rng: Rng, draft: Draft, crew: Crew): ProjectPlan {
  const { customer, dealId: deal, index } = draft;
  const business = isBusiness(customer);
  const { lines, capacityKwp } = deal
    ? fitPvLines(rng, business, customer.isVip, dealFacts(deal).amount)
    : buildLines(rng, draft.type, business, customer.isVip);
  const signedAt = deal
    ? dealFacts(deal).expectedClose
    : new Date(
        Math.min(
          atHour(draft.dates.start, rng.int(9, 17)).getTime() -
            rng.int(18, 40) * DAY_MS,
          helioNow() - DAY_MS,
        ),
      );
  return {
    index,
    projectId: projectId(index),
    quoteId: quoteId(index),
    dealId: deal,
    customer,
    type: draft.type,
    status: draft.status,
    start: atHour(draft.dates.start, 8),
    end: atHour(draft.dates.end, 17),
    signedAt,
    lines,
    capacityKwp,
    vatRate: business ? VAT_BUSINESS : VAT_RESIDENTIAL,
    leadTechnician: crew.leadTechnician,
    crew: crew.crew,
  };
}

/**
 * The statuses anchored on today (installed, on site now). Those projects are
 * staffed first; the others then take their crews in the order the work
 * starts, moving a few working days later when nobody is free, so nobody is on
 * two sites the same day. A finished project never moves past the week before
 * today; paused projects book nobody.
 */
const ANCHORED: ReadonlySet<ProjectStatus> = new Set([
  "inspection",
  "in_progress",
]);
/** The most working days a project may move by to find a free crew. */
const MAX_SHIFT_DAYS = 15;

function crewRequest(draft: Draft, dates: Dates): CrewRequest {
  return {
    province: draft.customer.address.countrySubdivision,
    type: draft.type,
    start: dates.start,
    end: dates.end,
    books: draft.status !== "on_hold",
  };
}

/**
 * The working days a project may move by: a finished one either way (it stays
 * signed off a week before today), a coming one only later.
 */
function shifts(status: ProjectStatus): number[] {
  const later = Array.from({ length: MAX_SHIFT_DAYS }, (_, at) => at + 1);
  if (status !== "done") return [0, ...later];
  return [0, ...later.flatMap((day) => [day, -day])];
}

function fits(draft: Draft, dates: Dates): boolean {
  if (draft.earliest && dates.start < draft.earliest) return false;
  return draft.status !== "done" || dates.end.getTime() <= dayAt(-8).getTime();
}

function staff(planner: CrewPlanner, draft: Draft): Crew | undefined {
  if (ANCHORED.has(draft.status) || draft.status === "on_hold")
    return planner.assign(crewRequest(draft, draft.dates));
  for (const shift of shifts(draft.status)) {
    const dates = span(addWorkdays(draft.dates.start, shift), draft.days);
    if (!fits(draft, dates)) continue;
    const crew = planner.assign(crewRequest(draft, dates), true);
    if (crew) {
      draft.dates = dates;
      return crew;
    }
  }
  return planner.assign(crewRequest(draft, draft.dates));
}

function assignCrews(drafts: Draft[]): Map<number, Crew> {
  const planner = new CrewPlanner(createRng(0x9e11000a));
  const crews = new Map<number, Crew>();
  const order = [...drafts].sort(
    (a, b) =>
      Number(ANCHORED.has(b.status)) - Number(ANCHORED.has(a.status)) ||
      a.dates.start.getTime() - b.dates.start.getTime(),
  );
  for (const draft of order) {
    const crew = staff(planner, draft);
    if (crew) crews.set(draft.index, crew);
  }
  return crews;
}

/**
 * Builds the plans in index order. The finished projects started over the past
 * year along the season, and were all signed off (installed more than a week
 * ago).
 */
function buildPlans(): ProjectPlan[] {
  const rng = createRng(0x9e110001);
  const doneStarts = seasonalWorkdays(rng, DONE_COUNT, -350, -16);
  const drafts = Array.from({ length: COUNTS.projects }, (_, at) =>
    draftProject(rng, at + 1, doneStarts[at]),
  );
  const crews = assignCrews(drafts);
  return drafts.map((draft) => {
    const crew = crews.get(draft.index);
    if (!crew) throw new Error(`No crew for project ${draft.index}`);
    return toPlan(rng, draft, crew);
  });
}

/** The plans, built on first use. */
let plans: ProjectPlan[] | undefined;

/** One plan per project, `proj-001` … `proj-080`, oldest first. */
export function projectPlans(): ProjectPlan[] {
  plans ??= buildPlans();
  return plans;
}
