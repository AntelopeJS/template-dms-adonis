import type { ActionType } from "@antelopejs/interface-dms-automation";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { UserModel } from "@antelopejs/interface-dms/auth/db";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { CustomerModel } from "../../crm/database";
import { type Site, SiteModel } from "../../monitoring/database";
import {
  type Ticket,
  type TicketCategory,
  TicketModel,
  type TicketPriority,
} from "../../service/database";
import type { TicketSeed } from "../../service/fixtures";
import { defaultHolderFor } from "../../service/assignees";
import { notifyUrgentTicket } from "../../service/notifications";
import { nextTicketNumber } from "../../service/numbering";
import {
  SERVICE_DESK_PATH,
  SERVICE_TOPIC,
  SLA_HOURS,
} from "../../service/options";
import { currentSettings } from "../../settings/current";
import { TeamMemberModel } from "../../team/database";
import type { JsonValue } from "../../shared/json";
import { type AlertKind, alertKindOf, priorityOf } from "./alert-kinds";
import { fireTicketOpened } from "./events";
import { helioNow } from "../../shared/clock";

const HOUR_MS = 60 * 60 * 1000;
const CLOSED = new Set(["resolved", "closed"]);

/** What a monitoring platform posts (also accepted under `payload`). */
interface AlertInput {
  payload?: AlertInput;
  siteId?: string;
  alert?: JsonValue;
  severity?: JsonValue;
  message?: string;
}

/** What opening a ticket from an alert reports, whether it opened one or found it open. */
type CreatedTicketOutput = {
  created: boolean;
  ticketId: string;
  number: string;
  priority: TicketPriority;
  summary: string;
};

/** What the on-call assignment reports. */
type AssignmentOutput = {
  alertsOn: boolean;
  assignee: string;
  number: string;
  summary: string;
  link: string;
};

const deskLink = (number: string) =>
  `${SERVICE_DESK_PATH}?ticket=${encodeURIComponent(number)}`;

async function findSite(siteId: string | undefined): Promise<Site> {
  const site = siteId ? await GetModel(SiteModel).get(siteId) : undefined;
  if (!site) throw new Error(`unknown monitored site "${siteId ?? ""}"`);
  return site;
}

/**
 * The still-open monitoring-alert ticket of a site for a category, if any. It
 * keeps the action to one open alert ticket per site and problem, since a
 * monitoring platform repeats its alert until the problem is fixed.
 */
async function openAlertTicket(
  site: Site,
  category: TicketCategory,
): Promise<Ticket | undefined> {
  const tickets = await GetModel(TicketModel).getBy("site", site._id);
  return tickets.find(
    (ticket) =>
      ticket.channel === "monitoring_alert" &&
      ticket.category === category &&
      !CLOSED.has(ticket.status),
  );
}

/**
 * Inserts the ticket of a monitoring alert. An urgent one is left unassigned
 * for the "urgent ticket" procedure to hand out (see `defaultHolderFor`).
 */
async function insertAlertTicket(
  site: Site,
  kind: AlertKind,
  priority: TicketPriority,
  message: string | undefined,
): Promise<TicketSeed> {
  const createdAt = new Date(helioNow());
  const ticket: TicketSeed = {
    _id: `ticket-alert-${createdAt.getTime().toString(36)}`,
    number: await nextTicketNumber(),
    subject: `Alerte monitoring — ${kind.subject} (${site.name})`,
    customer: site.customer,
    site: site._id,
    category: kind.category,
    priority,
    status: "new",
    channel: "monitoring_alert",
    slaDueAt: new Date(createdAt.getTime() + SLA_HOURS[priority] * HOUR_MS),
    createdAt,
    resolvedAt: undefined,
    assignee: await defaultHolderFor(priority),
    description:
      message ||
      `Alerte reçue de la plateforme de monitoring pour ${site.name} (${site.city}).`,
    pinned: false,
  };
  await GetModel(TicketModel).insert(ticket);
  return ticket;
}

/** Opens a service ticket from a monitoring alert, unless that alert is already tracked by an open ticket. */
const createTicket: ActionType<AlertInput, CreatedTicketOutput> = {
  id: "helio.create-ticket",
  name: "$helio.platform.automation.actions.createTicket.name",
  description: "$helio.platform.automation.actions.createTicket.description",
  icon: "i-ph-lifebuoy",
  inputSchema: {
    type: "object",
    properties: {
      payload: {
        type: "object",
        title: "$helio.platform.automation.actions.createTicket.payload",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      created: {
        type: "boolean",
        title: "$helio.platform.automation.fields.created",
      },
      ticketId: {
        type: "string",
        title: "$helio.platform.automation.fields.ticketId",
      },
      number: {
        type: "string",
        title: "$helio.platform.automation.fields.number",
      },
      priority: {
        type: "string",
        title: "$helio.platform.automation.fields.priority",
      },
      summary: {
        type: "string",
        title: "$helio.platform.automation.fields.summary",
      },
    },
  },
  async execute(input, ctx) {
    const alert = { ...input.payload, ...input, payload: undefined };
    const site = await findSite(alert.siteId);
    const kind = alertKindOf(alert.alert);
    const existing = await openAlertTicket(site, kind.category);
    if (existing) {
      ctx.log("info", `alert already tracked by ${existing.number}`);
      return {
        created: false,
        ticketId: existing._id,
        number: existing.number,
        priority: existing.priority,
        summary: `${existing.number} · ${site.name} (already open)`,
      };
    }
    const priority = priorityOf(alert.severity);
    const ticket = await insertAlertTicket(site, kind, priority, alert.message);
    await PublishMessage(SERVICE_TOPIC, "tickets.created", {
      payload: { ids: [ticket._id] },
    });
    if (priority === "urgent") await notifyUrgentTicket(ticket);
    fireTicketOpened(ticket);
    ctx.log("info", `ticket ${ticket.number} opened`, { site: site.name });
    return {
      created: true,
      ticketId: ticket._id,
      number: ticket.number,
      priority,
      summary: `${ticket.number} · ${ticket.subject}`,
    };
  },
};

/**
 * The technician with the fewest open tickets, who takes the urgent one. Only
 * technicians the team has now are considered, so a member removed since is
 * never picked.
 */
async function onCallTechnician(): Promise<string | undefined> {
  const technicians = (await GetModel(TeamMemberModel).getAll())
    .filter((member) => member.role === "technician")
    .map(({ _id }) => _id);
  const open = (await GetModel(TicketModel).getAll()).filter(
    (ticket) => ticket.assignee && !CLOSED.has(ticket.status),
  );
  const load = (id: string) =>
    open.filter((ticket) => ticket.assignee === id).length;
  return technicians.reduce<string | undefined>(
    (best, id) => (best === undefined || load(id) < load(best) ? id : best),
    undefined,
  );
}

async function memberName(id: string | undefined): Promise<string> {
  const member = id ? await GetModel(TeamMemberModel).get(id) : undefined;
  return member?.name ?? "—";
}

/**
 * Gives an unassigned ticket to the on-call technician (an assigned one keeps
 * its holder). The `alertsOn` output carries the "Urgent tickets" switch of
 * the Settings page: when it is off the ticket is still assigned but nobody is
 * told, because the dispatch procedure's If node reads it.
 */
const assignOnCall: ActionType<{ ticketId?: string }, AssignmentOutput> = {
  id: "helio.assign-on-call",
  name: "$helio.platform.automation.actions.assignOnCall.name",
  description: "$helio.platform.automation.actions.assignOnCall.description",
  icon: "i-ph-user-switch",
  inputSchema: {
    type: "object",
    properties: {
      ticketId: {
        type: "string",
        title: "$helio.platform.automation.fields.ticketId",
      },
    },
    required: ["ticketId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      alertsOn: {
        type: "boolean",
        title: "$helio.platform.automation.fields.alertsOn",
      },
      assignee: {
        type: "string",
        title: "$helio.platform.automation.fields.assignee",
      },
      number: {
        type: "string",
        title: "$helio.platform.automation.fields.number",
      },
      summary: {
        type: "string",
        title: "$helio.platform.automation.fields.summary",
      },
      link: { type: "string", title: "$helio.platform.automation.fields.link" },
    },
  },
  async execute(input, ctx) {
    const model = GetModel(TicketModel);
    const ticket = input.ticketId ? await model.get(input.ticketId) : undefined;
    if (!ticket) throw new Error(`unknown ticket "${input.ticketId ?? ""}"`);
    const assignee = ticket.assignee ?? (await onCallTechnician());
    if (!ticket.assignee && assignee) {
      await model.update(ticket._id, {
        assignee,
        status: ticket.status === "new" ? "open" : ticket.status,
      });
      await PublishMessage(SERVICE_TOPIC, "tickets.updated", {
        payload: { ids: [ticket._id] },
      });
    }
    const [customer, name, settings] = await Promise.all([
      GetModel(CustomerModel).get(ticket.customer),
      memberName(assignee),
      currentSettings(),
    ]);
    ctx.log("info", `${ticket.number} handled by ${name}`);
    return {
      alertsOn: settings.notifyUrgentTickets !== false,
      assignee: name,
      number: ticket.number,
      summary: `${ticket.number} · ${name} · ${ticket.subject} — ${customer?.name ?? ""}`,
      link: deskLink(ticket.number),
    };
  },
};

/** Finds the owners of the instance, the people automation notifies. */
const findManagers: ActionType<Record<string, never>, { userIds: string[] }> = {
  id: "helio.find-managers",
  name: "$helio.platform.automation.actions.findManagers.name",
  description: "$helio.platform.automation.actions.findManagers.description",
  icon: "i-ph-users-three",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      userIds: {
        type: "array",
        title: "$helio.platform.automation.fields.userIds",
        items: { type: "string" },
      },
    },
  },
  async execute() {
    const owners = await GetModel(UserModel).getOwners();
    return { userIds: owners.map((owner) => owner._id) };
  },
};

/**
 * Helio's actions about the service desk: open a ticket from a monitoring
 * alert (the webhook procedure), hand an urgent ticket to the technician on
 * call, and find who manages the instance.
 */
export const serviceActionTypes = [createTicket, assignOnCall, findManagers];
