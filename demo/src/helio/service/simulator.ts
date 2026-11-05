import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { SiteModel, type Site } from "../monitoring/database";
import { fireTicketOpened } from "../platform/automation/events";
import { createRng, type Rng } from "../shared/seed";
import { type Ticket, type TicketChannel, TicketModel } from "./database";
import {
  assigneeFor,
  channelFor,
  isBusinessHours,
  isTechnical,
  pickCategory,
  priorityFor,
} from "./desk-rules";
import type { TicketSeed } from "./fixtures";
import { notifyUrgentTicket } from "./notifications";
import { nextTicketNumber } from "./numbering";
import { SERVICE_TOPIC } from "./options";
import { refreshSlaHours, slaDueAt } from "./sla";
import { SUBJECTS } from "./subjects";

const SIMULATED_PREFIX = "ticket-sim-";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const FIRST_TICK_MS = 30_000;
const INTERVAL_MS = 5 * MINUTE_MS;
const JITTER_MS = MINUTE_MS;
/** Outside office hours, the share of ticks that bring an inverter alert. */
const NIGHT_ALERT_CHANCE = 0.3;
/** A new simulated ticket is assigned after this long… */
const ASSIGN_AFTER_MS = 3 * MINUTE_MS;
/** …resolved this long after it arrived… */
const RESOLVE_AFTER_MS = 15 * MINUTE_MS;
/** …and cleared from the desk this long after it was resolved. */
const CLEAR_AFTER_MS = 10 * MINUTE_MS;
/** A safety net: never more clearable simulated tickets than this at once. */
const MAX_SIMULATED = 12;
/** An urgent simulated ticket follows the previous one this long after. */
const URGENT_SPACING_MS = 3 * HOUR_MS;

const isOpen = (ticket: Ticket): boolean => !ticket.resolvedAt;
const isSimulated = (ticket: Ticket): boolean =>
  ticket._id.startsWith(SIMULATED_PREFIX);
/**
 * Whether the ticket notified the owners (notifications.ts): the notification
 * links to it, so it is never cleared.
 */
const isNotified = (ticket: Ticket): boolean => ticket.priority === "urgent";

/** Open tickets held, by assignee: the dispatcher evens the load out. */
function loadOf(tickets: Ticket[]): Map<string, number> {
  const load = new Map<string, number>();
  for (const ticket of tickets.filter(isOpen)) {
    if (ticket.assignee)
      load.set(ticket.assignee, (load.get(ticket.assignee) ?? 0) + 1);
  }
  return load;
}

/**
 * A ticket from a customer whose installation Helio monitors: a technical
 * request names the site, a billing or general one only the customer. With
 * `alertOnly` (outside office hours) only the inverters write in, and
 * without `urgentAllowed` an urgent draw becomes high.
 */
function draftTicket(
  rng: Rng,
  site: Site,
  number: string,
  options: { alertOnly: boolean; urgentAllowed: boolean },
): TicketSeed {
  const { alertOnly, urgentAllowed } = options;
  const category = alertOnly
    ? rng.pick(["inverter_error", "no_production"] as const)
    : pickCategory(rng);
  const technical = isTechnical(category);
  const drawn = priorityFor(rng, category);
  const priority = drawn === "urgent" && !urgentAllowed ? "high" : drawn;
  const channel: TicketChannel = alertOnly
    ? "monitoring_alert"
    : channelFor(rng, category);
  const text = rng.pick(SUBJECTS[category]);
  const createdAt = new Date();
  return {
    _id: `${SIMULATED_PREFIX}${createdAt.getTime().toString(36)}`,
    number,
    subject: text.subject,
    customer: site.customer,
    site: technical ? site._id : undefined,
    category,
    priority,
    status: "new",
    channel,
    slaDueAt: slaDueAt(priority, createdAt),
    createdAt,
    resolvedAt: undefined,
    assignee: undefined,
    description: text.description,
    pinned: false,
  };
}

interface Changes {
  updated: string[];
  deleted: string[];
}

/**
 * Moves the simulated tickets along: assigned, then resolved, then cleared (an
 * urgent one stays, resolved). Tickets a user already handled (assigned or
 * resolved by hand) follow the same clock from where they stand.
 */
async function advanceSimulated(
  rng: Rng,
  model: TicketModel,
  tickets: Ticket[],
): Promise<Changes> {
  const now = Date.now();
  const load = loadOf(tickets);
  const changes: Changes = { updated: [], deleted: [] };
  const simulated = tickets
    .filter(isSimulated)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let clearable = 0;
  for (const ticket of simulated) {
    const age = now - ticket.createdAt.getTime();
    const resolvedFor = ticket.resolvedAt
      ? now - ticket.resolvedAt.getTime()
      : 0;
    const kept = isNotified(ticket);
    if (!kept) clearable++;
    if (!kept && (resolvedFor > CLEAR_AFTER_MS || clearable > MAX_SIMULATED)) {
      await model.delete(ticket._id);
      changes.deleted.push(ticket._id);
    } else if (!ticket.resolvedAt && age > RESOLVE_AFTER_MS) {
      await model.update(ticket._id, {
        status: "resolved",
        resolvedAt: new Date(),
        assignee:
          ticket.assignee ??
          assigneeFor(rng, ticket.category, ticket.customer, load),
      });
      changes.updated.push(ticket._id);
    } else if (
      !ticket.assignee &&
      !ticket.resolvedAt &&
      age > ASSIGN_AFTER_MS
    ) {
      const assignee = assigneeFor(rng, ticket.category, ticket.customer, load);
      load.set(assignee, (load.get(assignee) ?? 0) + 1);
      await model.update(ticket._id, {
        assignee,
        status: ticket.status === "new" ? "open" : ticket.status,
      });
      changes.updated.push(ticket._id);
    }
  }
  return changes;
}

/** Tells the open desks, through the realtime topic, which tickets `event` happened to. */
async function announce(event: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await PublishMessage(SERVICE_TOPIC, event, { payload: { ids: [...ids] } });
}

/**
 * One tick: the desk's simulated tickets move on, and one may arrive. A new
 * ticket warns the owners when urgent, and fires the automation module's
 * "Ticket opened" trigger, so its procedures may start.
 */
export async function simulateTicket(): Promise<void> {
  const rng = createRng(Date.now() >>> 0);
  const model = GetModel(TicketModel);
  const tickets = await model.getAll();
  const changes = await advanceSimulated(rng, model, tickets);
  await announce("tickets.updated", changes.updated);
  await announce("tickets.deleted", changes.deleted);

  const officeHours = isBusinessHours(new Date());
  await refreshSlaHours();
  if (!officeHours && !rng.chance(NIGHT_ALERT_CHANCE)) return;
  const sites = await GetModel(SiteModel).getAll();
  if (sites.length === 0) return;
  const lastUrgent = tickets
    .filter((ticket) => isSimulated(ticket) && isNotified(ticket))
    .reduce(
      (latest, ticket) => Math.max(latest, ticket.createdAt.getTime()),
      0,
    );
  const ticket = draftTicket(rng, rng.pick(sites), await nextTicketNumber(), {
    alertOnly: !officeHours,
    urgentAllowed: Date.now() - lastUrgent >= URGENT_SPACING_MS,
  });
  await model.insert(ticket);
  await announce("tickets.created", [ticket._id]);
  if (ticket.priority === "urgent") await notifyUrgentTicket(ticket);
  fireTicketOpened(ticket);
}

/**
 * The timer lives on globalThis: a hot reload re-imports this module, and the
 * previous copy's timer must stop rather than run beside the new one. A run
 * still writing when the simulator stops does not schedule the next one: its
 * token is no longer the current one.
 */
interface SimulatorState {
  token: symbol;
  timer?: ReturnType<typeof setTimeout>;
}

declare global {
  /** The one simulator of the process, whichever copy of this module runs. */
  var helioServiceSimulator: SimulatorState | undefined;
}

function schedule(token: symbol, delay: number): void {
  const state = globalThis.helioServiceSimulator;
  if (state?.token !== token) return;
  state.timer = setTimeout(() => {
    simulateTicket()
      .catch((error: unknown) =>
        Logging.Error(`[helio] ticket simulator: ${String(error)}`),
      )
      .finally(() =>
        schedule(token, INTERVAL_MS + (Math.random() * 2 - 1) * JITTER_MS),
      );
  }, delay);
  state.timer.unref?.();
}

/** Whether the simulator may run: on unless HELIO_SIMULATORS=off. */
export function isServiceSimulatorEnabled(): boolean {
  return process.env.HELIO_SIMULATORS?.toLowerCase() !== "off";
}

/**
 * Starts the simulator (idempotent); does nothing when switched off with
 * `HELIO_SIMULATORS=off`. `src/index.ts` calls it once the template schema is
 * registered, and stops it with the module.
 *
 * A demo needs a desk that moves, at the pace of a real one: during office
 * hours a customer of one of the monitored installations writes in every few
 * minutes (outside them, only an inverter alert now and then), and the
 * tickets it wrote move along like real ones: the dispatcher assigns a new
 * ticket to a technician of the customer's region (the office for a billing
 * question), who resolves it a little later. Resolved simulated tickets are
 * then cleared, so the open, unassigned and weekday/hour counts stay steady
 * however long the instance runs, except the urgent ones: their notification
 * links to them, so they stay on the desk once resolved, like any ticket a
 * user was told about, and arrive three hours apart at least. Every change
 * reaches the open desks through the realtime topic.
 */
export function startServiceSimulator(): void {
  stopServiceSimulator();
  if (!isServiceSimulatorEnabled()) return;
  const token = Symbol("run");
  globalThis.helioServiceSimulator = { token };
  schedule(token, FIRST_TICK_MS);
}

/** Stops the simulator; safe to call when it is not running. */
export function stopServiceSimulator(): void {
  const state = globalThis.helioServiceSimulator;
  if (state?.timer) clearTimeout(state.timer);
  globalThis.helioServiceSimulator = undefined;
}
