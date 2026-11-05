import {
  Controller,
  type ControllerClass,
  type RequestContext,
} from "@antelopejs/interface-api";
import {
  type DataControllerCallback,
  type DataControllerCallbackWithOptions,
  DataController,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  Listable,
  ModelReference,
  Sortable,
} from "@antelopejs/interface-data-api/metadata";
import { GetModel, Model } from "@antelopejs/interface-database-decorators";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import {
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { HelioSettingsModel } from "../settings/database";
import { HELIO_SETTINGS_ID } from "../settings/types";
import { isObject } from "../shared/json";
import type { TeamRole } from "../shared/roster";
import { TeamMember, TeamMemberModel } from "../team/database";
import { TicketModel } from "./database";
import { SERVICE_TOPIC } from "./options";

/**
 * The roles a ticket can be assigned to: the technicians, and the office for
 * the billing questions, never the manager or the sales reps.
 */
export const TICKET_HOLDER_ROLES: ReadonlySet<TeamRole> = new Set([
  "technician",
  "office",
]);

/**
 * The team members who may hold a ticket, by name. The bulk "Assign to…"
 * action reads them, like the ticket's assignee column reads the controller
 * below, so the form picker, the desk's quick filter and the action offer the
 * same people, newcomers included.
 */
export async function ticketHolders(): Promise<TeamMember[]> {
  const members = await GetModel(TeamMemberModel).getAll();
  return members
    .filter((member) => TICKET_HOLDER_ROLES.has(member.role))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Whether `id` names a team member who may hold a ticket. */
export async function isTicketHolder(id: string | undefined): Promise<boolean> {
  if (!id) return false;
  const member = await GetModel(TeamMemberModel).get(id);
  return member !== undefined && TICKET_HOLDER_ROLES.has(member.role);
}

/**
 * Who takes a ticket that arrives without a holder (from the desk's form or
 * a monitoring alert), in this order:
 * 1. an urgent ticket is left to the "urgent ticket" procedure of the
 *    automation module, which hands it to the technician holding the fewest
 *    open tickets (it stays unassigned if that procedure is turned off);
 * 2. any other one goes to the "Default technician" of the Settings page,
 *    while the team still has them as a technician or in the office;
 * 3. else nobody: it waits in the desk's "Unassigned" view.
 */
export async function defaultHolderFor(
  priority: string | undefined,
): Promise<string | undefined> {
  if (priority === "urgent") return undefined;
  const settings = await GetModel(HelioSettingsModel).get(HELIO_SETTINGS_ID);
  const id = settings?.defaultTechnician ?? undefined;
  return (await isTicketHolder(id)) ? id : undefined;
}

/**
 * Hands the open tickets of members leaving the team back to nobody: they
 * show in the desk's "Unassigned" view and every unassigned count, ready
 * for a new holder. Resolved and closed tickets keep who held them. The
 * holder is cleared with `null`, as `undefined` would leave it in place.
 */
export async function releaseOpenTickets(memberIds: string[]): Promise<void> {
  const leaving = new Set(memberIds);
  const model = GetModel(TicketModel);
  const held = (await model.getAll()).filter(
    (ticket) =>
      !ticket.resolvedAt && ticket.assignee && leaving.has(ticket.assignee),
  );
  const nobody = Object.fromEntries([["assignee", null]]);
  await Promise.all(held.map(({ _id }) => model.update(_id, nobody)));
  if (held.length > 0) {
    await PublishMessage(SERVICE_TOPIC, "tickets.updated", {
      payload: { ids: held.map(({ _id }) => _id) },
    });
  }
}

/** The part of a select route's answer that `holdersOnly` reads and rewrites. */
interface SelectPage {
  results: unknown[];
}

function isSelectPage(value: unknown): value is SelectPage {
  return isObject(value) && "results" in value && Array.isArray(value.results);
}

/** Whether a row of the select answer names a member who may hold a ticket. */
function isHolderRow(row: unknown): row is { role: TeamRole } {
  return (
    isObject(row) &&
    "role" in row &&
    [...TICKET_HOLDER_ROLES].some((holder) => holder === row.role)
  );
}

/** Page size used to read the whole team (a dozen people) in one go. */
const WHOLE_TEAM = 200;

/**
 * The team's select route, keeping the people who may hold a ticket. The
 * data API has no "one of" route filter, so the rows are kept after the read:
 * the whole team is read in one page, whatever page size the picker asks for,
 * and the total is the kept count.
 */
function holdersOnly(
  route: DataControllerCallbackWithOptions,
): DataControllerCallbackWithOptions {
  const callback: DataControllerCallback = route.callback;
  return {
    ...route,
    callback: {
      ...callback,
      func: async function (
        this: unknown,
        ctx: RequestContext,
        params: { limit?: number; offset?: number } | undefined,
        ...rest: unknown[]
      ) {
        const page: unknown = await callback.func.call(
          this,
          ctx,
          { ...params, limit: WHOLE_TEAM, offset: 0 },
          ...rest,
        );
        if (!isSelectPage(page)) return page;
        const results = page.results.filter(isHolderRow);
        return { ...page, results, total: results.length };
      },
    },
  };
}

/**
 * The team members a ticket can be assigned to, read by the ticket's assignee
 * column instead of the whole team. It is not exported on purpose: emitting a
 * .d.ts for it would require naming types from the nested
 * `@antelopejs/interface-core` copies (TS2742); `ticketAssigneeController` is
 * exported instead.
 */
@RegisterDataController()
class ticketAssigneeDataAPI extends DataController(
  TeamMember,
  {
    get: TableViewRoutes.Get,
    select: holdersOnly(TableViewRoutes.Select),
  },
  Controller("/api/helio/ticket-assignees"),
) {
  @ModelReference()
  @Model(TeamMemberModel)
  declare model: TeamMemberModel;

  @Select()
  @Listable()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Access(AccessMode.ReadOnly)
  declare name: string;

  @Select()
  @Listable()
  @Access(AccessMode.ReadOnly)
  declare avatar: string;

  @Select()
  @Listable()
  @Access(AccessMode.ReadOnly)
  declare role: string;
}

export type TicketAssigneeRow = {
  [Field in keyof ticketAssigneeDataAPI]: ticketAssigneeDataAPI[Field];
};

export const ticketAssigneeController: ControllerClass<TicketAssigneeRow> =
  ticketAssigneeDataAPI;
