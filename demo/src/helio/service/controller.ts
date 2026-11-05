import {
  Context,
  Controller,
  type ControllerClass,
  HTTPResult,
  JSONBody,
  Post,
  type RequestContext,
} from "@antelopejs/interface-api";
import {
  DataController,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  Listable,
  Mandatory,
  ModelReference,
  Optional,
  Sortable,
} from "@antelopejs/interface-data-api/metadata";
import { Model } from "@antelopejs/interface-database-decorators";
import { AuthUser } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import {
  type CellSubline,
  Column,
  DefaultDisplays,
  Exported,
  resolveBulkRowIds,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { customerController } from "../crm/controller";
import { mailTicketsResolved } from "../platform/mailing/send";
import { siteController } from "../monitoring/controller";
import { assertCanWriteTickets } from "./access";
import { logTicketsReopened, logTicketsResolved } from "./activity";
import { isTicketHolder, ticketAssigneeController } from "./assignees";
import {
  Ticket,
  TicketModel,
  type TicketPriority,
  type TicketStatus,
} from "./database";
import { withTicketNumber } from "./numbering";
import { slaDueAt } from "./sla";
import {
  SERVICE_TOPIC,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "./options";
import { helioNow } from "../shared/clock";

export * from "./options";

const HOUR_MS = 60 * 60 * 1000;
const CLOSED: readonly string[] = ["resolved", "closed"];

const day = (date: Date) =>
  ({ type: "date", value: date.toISOString(), format: "day" }) as const;

/**
 * The tickets' data controller: the generated routes of the desk table, the
 * `new` route with the ticket number filled in, and the bulk routes of the
 * selection bar. It is not exported on purpose: emitting a .d.ts for this class
 * would require naming types from the nested `@antelopejs/interface-core`
 * copies (TS2742); `ticketController` is exported instead.
 */
@RegisterDataController()
class ticketDataAPI extends DataController(
  Ticket,
  { ...TableViewRoutes.All, new: withTicketNumber(TableViewRoutes.New) },
  Controller("/api/helio/tickets"),
) {
  @ModelReference()
  @Model(TicketModel)
  declare model: TicketModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  /**
   * Left empty on a new ticket, it takes the next number (see numbering.ts).
   */
  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.number",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.service.tickets.placeholders.number",
      maxLength: 12,
    }),
    filterable: true,
    display: new DefaultDisplays.MonoDisplay(),
    size: 90,
  })
  @Mandatory("edit")
  @Access(AccessMode.ReadWrite)
  declare number: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.subject",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.service.tickets.placeholders.subject",
      maxLength: 160,
    }),
    filterable: true,
    size: 195,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare subject: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.service.tickets.placeholders.customer",
    }),
    filterable: true,
    size: 160,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  /**
   * The picker lists the chosen customer's sites only; site-rule.ts still
   * refuses another customer's site on save.
   */
  @Listable()
  @Column({
    name: "$helio.service.tickets.columns.site",
    type: new DefaultDataTypes.RelationType({
      dataApiController: siteController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.service.tickets.placeholders.site",
      deselectable: true,
      filterBy: { field: "customer", from: "customer" },
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare site: string;

  /**
   * Hidden by default so the desk fits a 1440 px screen; the quick filter and
   * the column picker still offer it.
   */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.category",
    type: new DefaultDataTypes.SelectType({ items: [...TICKET_CATEGORIES] }),
    filterable: true,
    defaultValue: "other",
    isVisible: false,
    size: 170,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare category: string;

  /**
   * Writing the priority (always on creation) sets the SLA from the ticket's
   * creation time, which it stamps on a new ticket.
   */
  @Listable(["priority"])
  @Sortable()
  @Exported(["priority"])
  @Column({
    name: "$helio.service.tickets.columns.priority",
    type: new DefaultDataTypes.SelectType({ items: [...TICKET_PRIORITIES] }),
    filterable: true,
    defaultValue: "normal",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        low: "neutral",
        normal: "info",
        high: "warning",
        urgent: "error",
      },
      liveValues: ["urgent"],
    }),
    size: 135,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  get priority(): TicketPriority {
    return this.table.priority;
  }
  set priority(value: TicketPriority) {
    this.table.priority = value;
    this.table.createdAt ??= new Date(helioNow());
    this.table.slaDueAt = slaDueAt(value, new Date(this.table.createdAt));
  }

  /**
   * Resolving or closing a ticket stamps when; reopening it clears it.
   */
  @Listable(["status"])
  @Sortable()
  @Exported(["status"])
  @Column({
    name: "$helio.service.tickets.columns.status",
    type: new DefaultDataTypes.SelectType({ items: [...TICKET_STATUSES] }),
    filterable: true,
    defaultValue: "new",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        new: "info",
        open: "primary",
        waiting: "warning",
        resolved: "success",
        closed: "neutral",
      },
      subField: "statusDetail",
      subTone: "muted",
      liveValues: ["new"],
    }),
    size: 150,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  get status(): TicketStatus {
    return this.table.status;
  }
  set status(value: TicketStatus) {
    this.table.status = value;
    if (!CLOSED.includes(value)) this.table.resolvedAt = undefined;
    else this.table.resolvedAt ??= new Date(helioNow());
  }

  @Listable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.channel",
    type: new DefaultDataTypes.SelectType({ items: [...TICKET_CHANNELS] }),
    filterable: true,
    defaultValue: "phone",
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare channel: string;

  /**
   * Picked among the technicians and the office (see assignees.ts), in the form
   * and in the desk's quick filter alike.
   */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.assignee",
    type: new DefaultDataTypes.RelationType({
      dataApiController: ticketAssigneeController,
      keyMapping: { label: "name", value: "_id", avatar: "avatar" },
      placeholder: "$helio.service.tickets.placeholders.assignee",
      deselectable: true,
    }),
    filterable: true,
    size: 150,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare assignee: string;

  /**
   * The promised resolution time only matters while the ticket is open: a
   * resolved or closed one shows a dash instead of a countdown ("In 3 days").
   * Filters and sorting still read the stored date.
   */
  @Listable(["slaDueAt", "status"])
  @Sortable()
  @Exported(["slaDueAt", "status"])
  @Column({
    name: "$helio.service.tickets.columns.slaDueAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      soonWithinMs: 4 * HOUR_MS,
      soonTone: "warning",
      emptyLabel: "—",
      emptyTone: "dimmed",
    }),
    size: 115,
  })
  @Access(AccessMode.ReadOnly)
  get slaDueAt(): Date | null {
    return CLOSED.includes(this.table.status) ? null : this.table.slaDueAt;
  }

  /**
   * Hidden by default so the desk fits a 1440 px screen: the list is sorted
   * newest first, and the column picker brings it back.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.createdAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      nowWithinMs: 10 * 60 * 1000,
      nowLabel: "$helio.service.tickets.justNow",
    }),
    isVisible: false,
    size: 115,
  })
  @Access(AccessMode.ReadOnly)
  declare createdAt: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.service.tickets.columns.resolvedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare resolvedAt: Date;

  /**
   * Listable so the desk's expanded row can show it.
   */
  @Listable()
  @Column({
    name: "$helio.service.tickets.columns.description",
    type: new DefaultDataTypes.StringType({
      textarea: true,
      rows: 5,
      placeholder: "$helio.service.tickets.placeholders.description",
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare description: string;

  @Listable()
  @Column({
    name: "$helio.service.tickets.columns.pinned",
    type: new DefaultDataTypes.BooleanType(),
    filterable: true,
    defaultValue: false,
    display: new DefaultDisplays.IndicatorDisplay({
      onIcon: "i-ph-push-pin-fill",
      onTone: "primary",
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare pinned: boolean;

  /**
   * Shown under the status: an open ticket past its SLA (the promised resolution
   * time) in red, else when a resolved one was resolved.
   */
  @Listable(["status", "slaDueAt", "resolvedAt"])
  @Access(AccessMode.ReadOnly)
  get statusDetail(): CellSubline | null {
    const { status, slaDueAt, resolvedAt } = this.table;
    if (CLOSED.includes(status)) {
      return resolvedAt
        ? {
            text: {
              key: "$helio.service.tickets.detail.resolved",
              params: { date: day(resolvedAt) },
            },
          }
        : null;
    }
    if (slaDueAt && new Date(slaDueAt).getTime() < helioNow()) {
      return {
        text: "$helio.service.tickets.detail.slaBreached",
        tone: "error",
      };
    }
    return null;
  }

  /**
   * "Assign to…" on the selection bar: the selected tickets, or every ticket the
   * filters match, go to the person picked in the confirmation (a technician or
   * the office, read from the team as the dialog lists them). A new ticket
   * someone took is open from then on.
   */
  @Post("bulk/assign")
  async bulkAssign(
    @Context() ctx: RequestContext,
    @AuthUser() user: User,
    @JSONBody() body: { assignee?: string },
  ): Promise<{ count: number }> {
    await assertCanWriteTickets(ctx, user);
    const assignee = body?.assignee;
    if (!assignee || !(await isTicketHolder(assignee))) {
      throw new HTTPResult(400, {
        message: "$helio.service.bulk.assign.invalid",
        field: "assignee",
      });
    }
    const ids = await resolveBulkRowIds(this, ctx, user);
    const tickets = await this.loadTickets(ids);
    await Promise.all(
      tickets.map((ticket) =>
        this.model.update(ticket._id, {
          assignee,
          status: ticket.status === "new" ? "open" : ticket.status,
        }),
      ),
    );
    return this.published(tickets.map(({ _id }) => _id));
  }

  /**
   * "Resolve" on the selection bar: the tickets still open are resolved now, and
   * each customer is told by e-mail in the background; resolved and closed ones
   * are left as they are.
   */
  @Post("bulk/resolve")
  async bulkResolve(
    @Context() ctx: RequestContext,
    @AuthUser() user: User,
  ): Promise<{ count: number }> {
    await assertCanWriteTickets(ctx, user);
    const ids = await resolveBulkRowIds(this, ctx, user);
    const open = (await this.loadTickets(ids)).filter(
      ({ status }) => !CLOSED.includes(status),
    );
    const resolvedAt = new Date(helioNow());
    await Promise.all(
      open.map(({ _id }) =>
        this.model.update(_id, { status: "resolved", resolvedAt }),
      ),
    );
    void mailTicketsResolved(open.map(({ _id }) => _id));
    await logTicketsResolved(open);
    return this.published(open.map(({ _id }) => _id));
  }

  /**
   * "Reopen" on a resolved or closed ticket: it is open again, its resolution
   * date cleared, and the activity feed says so. Tickets still open are left as
   * they are. The date is cleared with `null`, as `undefined` would leave it in
   * place.
   */
  @Post("bulk/reopen")
  async bulkReopen(
    @Context() ctx: RequestContext,
    @AuthUser() user: User,
  ): Promise<{ count: number }> {
    await assertCanWriteTickets(ctx, user);
    const ids = await resolveBulkRowIds(this, ctx, user);
    const closed = (await this.loadTickets(ids)).filter(({ status }) =>
      CLOSED.includes(status),
    );
    const reopened = Object.fromEntries([
      ["status", "open"],
      ["resolvedAt", null],
    ]);
    await Promise.all(
      closed.map(({ _id }) => this.model.update(_id, reopened)),
    );
    await logTicketsReopened(closed);
    return this.published(closed.map(({ _id }) => _id));
  }

  /**
   * A selection-bar run also sends the row token of the actions, unresolved or
   * empty: an id naming no ticket is skipped.
   */
  private async loadTickets(ids: string[]): Promise<Ticket[]> {
    const rows = await Promise.all(
      ids.filter(Boolean).map((id) => this.model.get(id)),
    );
    return rows.filter((row): row is Ticket => row !== undefined);
  }

  /**
   * Announces the update on the service topic. The tickets are written through
   * the model, which the table's own realtime does not see: the desk's table and
   * stats follow the topic instead.
   */
  private async published(ids: string[]): Promise<{ count: number }> {
    if (ids.length > 0) {
      await PublishMessage(SERVICE_TOPIC, "tickets.updated", {
        payload: { ids },
      });
    }
    return { count: ids.length };
  }
}

/** `ControllerClass`-typed alias of the controller above, for relations and pages (see the TS2742 note on the class). */
export type TicketRow = {
  [Field in keyof ticketDataAPI]: ticketDataAPI[Field];
};

export const ticketController: ControllerClass<TicketRow> = ticketDataAPI;
