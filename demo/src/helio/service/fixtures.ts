import { buildSites, type SiteSeed } from "../monitoring/fixtures";
import { activeCustomers } from "../projects/crm-facts";
import { COUNTS, ticketId } from "../shared/roster";
import { createRng, DAY_MS, type Rng } from "../shared/seed";
import type {
  Ticket,
  TicketCategory,
  TicketChannel,
  TicketPriority,
  TicketStatus,
} from "./database";
import {
  assigneeFor,
  channelFor,
  isTechnical,
  pickCategory,
  priorityFor,
  sampleArrival,
} from "./desk-rules";
import { SLA_HOURS } from "./options";
import { SUBJECTS } from "./subjects";
import { helioNow } from "../shared/clock";

export type TicketSeed = Pick<
  Ticket,
  | "_id"
  | "number"
  | "subject"
  | "customer"
  | "site"
  | "category"
  | "priority"
  | "status"
  | "channel"
  | "assignee"
  | "slaDueAt"
  | "createdAt"
  | "resolvedAt"
  | "description"
  | "pinned"
>;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HISTORY_DAYS = 182;
const FIRST_NUMBER = 1000;
/** Share of the past tickets resolved after their SLA. */
const LATE_SHARE = 0.07;
/** A resolved ticket the customer did not reopen is closed after a week. */
const CLOSE_AFTER_MS = 7 * DAY_MS;
/** Open tickets inside their SLA, then the ones that slipped past it. */
const BACKLOG = 14;
const SLIPPED = 2;

interface TicketDraft {
  createdAt: Date;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  site?: SiteSeed;
  customer: string;
  assignee?: string;
  resolvedAt?: Date;
}

const slaMs = (priority: TicketPriority): number =>
  SLA_HOURS[priority] * HOUR_MS;

/**
 * The installation a technical ticket is about: one already commissioned when
 * the customer wrote. A billing or general question names the customer only,
 * most often one Helio already installed for.
 */
function subjectOf(
  rng: Rng,
  sites: SiteSeed[],
  category: TicketCategory,
  createdAt: Date,
): Pick<TicketDraft, "site" | "customer"> {
  const running = sites.filter(
    (site) => site.commissionedAt.getTime() + DAY_MS < createdAt.getTime(),
  );
  if (isTechnical(category) && running.length > 0) {
    const site = rng.pick(running);
    return { site, customer: site.customer };
  }
  if (running.length > 0 && rng.chance(0.6))
    return { customer: rng.pick(running).customer };
  const known = activeCustomers().filter(
    (customer) => customer.createdAt.getTime() < createdAt.getTime(),
  );
  return {
    customer: rng.pick(known.length > 0 ? known : activeCustomers())._id,
  };
}

/**
 * A past ticket: resolved within its SLA, sometimes after it, and closed once
 * a week went by without the customer reopening it.
 */
function historyDraft(rng: Rng, sites: SiteSeed[]): TicketDraft {
  const now = helioNow();
  const category = pickCategory(rng);
  const channel = channelFor(rng, category);
  const priority = priorityFor(rng, category);
  const sla = slaMs(priority);
  const createdAt = sampleArrival(
    rng,
    channel,
    now - HISTORY_DAYS * DAY_MS,
    now - sla,
  );
  const share = rng.chance(LATE_SHARE)
    ? 1.05 + rng.next() * 1.2
    : 0.08 + rng.next() * 0.85;
  const resolvedAt = new Date(
    Math.min(createdAt.getTime() + sla * share, now - 30 * MINUTE_MS),
  );
  const { site, customer } = subjectOf(rng, sites, category, createdAt);
  return {
    createdAt,
    category,
    priority,
    status: now - resolvedAt.getTime() < CLOSE_AFTER_MS ? "resolved" : "closed",
    channel,
    site,
    customer,
    assignee: assigneeFor(rng, category, customer),
    resolvedAt,
  };
}

/**
 * The status of an open ticket: new when it arrived in the last hours (most
 * not assigned yet), else in the hands of someone, possibly waiting on the
 * customer.
 */
function openStatus(rng: Rng, ageMs: number): TicketStatus {
  if (ageMs < 6 * HOUR_MS && rng.chance(0.6)) return "new";
  if (ageMs < DAY_MS) return "open";
  return rng.chance(0.35) ? "waiting" : "open";
}

/**
 * An open ticket, inside its SLA or, for the ones that `slipped`, past it by
 * up to nearly twice its length.
 */
function openDraft(rng: Rng, sites: SiteSeed[], slipped: boolean): TicketDraft {
  const now = helioNow();
  const category = pickCategory(rng);
  const channel = channelFor(rng, category);
  const priority = slipped ? "high" : priorityFor(rng, category);
  const sla = slaMs(priority);
  const [minAge, maxAge] = slipped
    ? [sla * 1.15, sla * 1.9]
    : [10 * MINUTE_MS, sla * 0.9];
  const createdAt = sampleArrival(rng, channel, now - maxAge, now - minAge);
  const status = slipped ? "open" : openStatus(rng, now - createdAt.getTime());
  const { site, customer } = subjectOf(rng, sites, category, createdAt);
  const assigned = status !== "new" || rng.chance(0.3);
  return {
    createdAt,
    category,
    priority,
    status,
    channel,
    site,
    customer,
    assignee: assigned ? assigneeFor(rng, category, customer) : undefined,
  };
}

/**
 * The alerts of the offline and degraded inverters: an offline site waits for
 * a replacement inverter (past its SLA, pinned), a degraded one was flagged
 * in the last hours.
 */
function alertDrafts(rng: Rng, sites: SiteSeed[]): TicketDraft[] {
  return sites
    .filter((site) => site.inverterStatus !== "online")
    .map((site): TicketDraft => {
      const offline = site.inverterStatus === "offline";
      const createdAt = offline
        ? new Date(site.lastSeenAt.getTime() + 30 * MINUTE_MS)
        : new Date(helioNow() - rng.int(2 * 60, 20 * 60) * MINUTE_MS);
      const status: TicketStatus = offline
        ? "waiting"
        : rng.pick(["new", "open", "open"] as const);
      const category = offline ? "no_production" : "inverter_error";
      return {
        createdAt,
        category,
        priority: offline ? "urgent" : "high",
        status,
        channel: "monitoring_alert",
        site,
        customer: site.customer,
        assignee:
          status === "new"
            ? undefined
            : assigneeFor(rng, category, site.customer),
      };
    });
}

/** Urgent calls of the last hours, still inside their four-hour SLA. */
function urgentDrafts(rng: Rng, sites: SiteSeed[]): TicketDraft[] {
  const online = sites.filter((row) => row.inverterStatus === "online");
  return [0.5, 1.4, 2.3, 3.2].map((hoursAgo): TicketDraft => {
    const site = rng.pick(online);
    const category = rng.pick(["no_production", "damage"] as const);
    const status: TicketStatus = hoursAgo < 1.5 ? "new" : "open";
    return {
      createdAt: new Date(helioNow() - hoursAgo * HOUR_MS),
      category,
      priority: "urgent",
      status,
      channel: rng.pick(["phone", "portal"] as const),
      site,
      customer: site.customer,
      assignee:
        status === "new"
          ? undefined
          : assigneeFor(rng, category, site.customer),
    };
  });
}

function toSeed(rng: Rng, draft: TicketDraft, index: number): TicketSeed {
  const text = rng.pick(SUBJECTS[draft.category]);
  return {
    _id: ticketId(index),
    number: "",
    subject: text.subject,
    customer: draft.customer,
    site: draft.site?._id,
    category: draft.category,
    priority: draft.priority,
    status: draft.status,
    channel: draft.channel,
    assignee: draft.assignee,
    slaDueAt: new Date(draft.createdAt.getTime() + slaMs(draft.priority)),
    createdAt: draft.createdAt,
    resolvedAt: draft.resolvedAt,
    description: text.description,
    pinned: false,
  };
}

/**
 * Numbers the seeds by creation date (T-1001 is the oldest) and pins the
 * alerts of the offline sites at the top of the desk.
 */
function finish(seeds: TicketSeed[], sites: SiteSeed[]): void {
  const sorted = [...seeds].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  sorted.forEach((seed, at) => {
    seed.number = `T-${FIRST_NUMBER + at + 1}`;
  });
  const offline = new Set(
    sites
      .filter((site) => site.inverterStatus === "offline")
      .map(({ _id }) => _id),
  );
  for (const seed of seeds) {
    seed.pinned =
      !seed.resolvedAt &&
      seed.channel === "monitoring_alert" &&
      seed.site !== undefined &&
      offline.has(seed.site);
  }
}

let tickets: TicketSeed[] | undefined;

/**
 * The 300 tickets, `ticket-001` … `ticket-300`: six months of after-sales
 * requests, as a desk that keeps its promises holds them. Nearly every past
 * ticket was resolved within its SLA (a few were late); the tickets still open
 * are recent ones, inside their SLA, except the alerts of the two offline
 * sites and a couple of tickets that slipped. Technical tickets sit on a
 * monitored site of their customer, commissioned before the ticket, and go to
 * a technician of the customer's region; billing and general questions go to
 * the office.
 */
export function buildTickets(): TicketSeed[] {
  if (!tickets) {
    const rng = createRng(0x9e110006);
    const sites = buildSites();
    const drafts = [
      ...alertDrafts(rng, sites),
      ...urgentDrafts(rng, sites),
      ...Array.from({ length: SLIPPED }, () => openDraft(rng, sites, true)),
      ...Array.from({ length: BACKLOG }, () => openDraft(rng, sites, false)),
    ];
    while (drafts.length < COUNTS.tickets)
      drafts.push(historyDraft(rng, sites));
    tickets = drafts.map((draft, at) => toSeed(rng, draft, at + 1));
    finish(tickets, sites);
  }
  return tickets;
}
