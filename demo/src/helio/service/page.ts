import { Context, Get, type RequestContext } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { AuthUser } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { LiveToggle } from "@antelopejs/interface-dms/base/live-toggle";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import {
  serializeConfirmDialog,
  TableView,
  tableViewLink,
} from "@antelopejs/interface-dms/base/table-view";
import type { ConfirmDialogSerialized } from "@antelopejs/interface-dms/base/types/confirm-dialog";
import {
  PageController,
  RegisterPage,
  pageRoutePath,
} from "@antelopejs/interface-dms/page";
import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { helioOperationsCategory } from "../category";
import { helioQuickActions } from "../shared/quick-actions";
import {
  assertCanRun,
  assertCanWriteTickets,
  setTicketWriteAction,
} from "./access";
import { logTicketReopened, logTicketResolved } from "./activity";
import { ticketHolders } from "./assignees";
import { ticketController } from "./controller";
import { TicketModel } from "./database";
import { SERVICE_DESK_PATH, SERVICE_TOPIC } from "./options";
import { assertSiteOfCustomer } from "./site-rule";
import { refreshSlaHours, slaHours } from "./sla";
import { serviceStats } from "./stats";
import {
  assignDialog,
  ticketFooter,
  ticketRowActions,
  ticketTabs,
  ticketViews,
} from "./table-options";

const route = (path: string) => pageRoutePath(SERVICE_DESK_PATH, path);

const isClosing = (status: string | undefined): boolean =>
  status === "resolved" || status === "closed";

/**
 * The after-sales desk: the tickets as they arrive (a live page, the
 * simulator writing one every few minutes during office hours), opened in a
 * drawer with a click, triaged with saved views, quick filters and bulk
 * actions. Its menu badge counts every ticket still open (new, open or
 * waiting for the customer), the same set as the "Open tickets" figure above
 * the desk and the "Open" view, as one count rather than one badge per status
 * tab, whose counts the menu would add up and which could then disagree. It is
 * drawn in warning while new tickets wait for someone to look at them.
 */
@RegisterPage()
export class PageHelioService extends PageController(
  "service",
  {
    displayName: "$helio.service.page.name",
    description: "$helio.service.page.description",
    icon: "i-ph-lifebuoy",
    category: helioOperationsCategory,
    order: 1,
    live: { maxRate: 3 },
  },
  DefaultLayout({ fullWidth: true }),
) {
  static live = LiveToggle({
    variant: "pill",
    align: "right",
    missedLabel: "$helio.service.live.missed",
  });

  static stats = StatGroup({
    layout: "cards",
    columns: 4,
    label: "$helio.service.stats.label",
    fetchUrl: route("/stats"),
    realtimeTopic: SERVICE_TOPIC,
    skeletonCount: 4,
  });

  /**
   * The ticket desk. A phone opens it on a card per ticket (its number,
   * subject, customer, state, priority, technician and deadline) rather than a
   * grid cut after its first columns; wide screens keep the grid.
   * `?ticket=T-1042` opens the desk on one ticket (the urgent-ticket
   * notification links there), shown as a removable chip. Every write first
   * reads the service levels of the Settings page, which the priority sets the
   * SLA from, and a ticket resolved, closed or reopened from its form reaches
   * the activity feed, as the "Resolve" and "Reopen" actions do. The bulk
   * routes check the table's own edit permission (see access.ts).
   */
  static table = TableView(ticketController, {
    caption: "$helio.service.table.caption",
    labelKey: "number",
    searchPlaceholder: "$helio.service.table.search",
    rowClick: "single",
    pageSize: 25,
    density: "compact",
    displays: [{ id: "table" }, { id: "cards" }],
    mobileDisplay: "cards",
    card: {
      fields: [
        "subject",
        "customer",
        "status",
        "priority",
        "assignee",
        "slaDueAt",
      ],
    },
    defaultSort: { field: "createdAt", desc: true },
    pinnedRows: { field: "pinned", equals: true },
    realtimeTopic: SERVICE_TOPIC,
    liveHold: {
      whileSearching: true,
      missedLabel: "$helio.service.live.newTickets",
    },
    queryParamFilters: {
      ticket: {
        field: "number",
        mode: "is",
        visible: true,
        label: "$helio.service.table.filters.ticket",
      },
    },
    quickFilters: [
      { field: "assignee", label: "$helio.service.table.filters.assignee" },
      { field: "priority", label: "$helio.service.table.filters.priority" },
      { field: "category", label: "$helio.service.table.filters.category" },
    ],
    views: ticketViews,
    tabs: ticketTabs,
    footer: ticketFooter,
    expandable: {
      fields: ["description", "site", "channel"],
      fieldsLabel: "$helio.service.table.expandLabel",
      single: true,
    },
    emptyStates: {
      firstRun: {
        title: "$helio.service.table.empty.firstRunTitle",
        description: "$helio.service.table.empty.firstRunDescription",
        icon: "i-ph-lifebuoy",
      },
      filtered: {
        title: "$helio.service.table.empty.filteredTitle",
        description: "$helio.service.table.empty.filteredDescription",
        icon: "i-ph-check-circle",
      },
    },
    formContainer: {
      type: "drawer",
      pages: {
        new: {
          displayName: "$helio.service.form.newTitle",
          description: "$helio.service.form.newDescription",
        },
        edit: { displayName: "$helio.service.form.editTitle" },
        details: { displayName: "$helio.service.form.detailsTitle" },
      },
    },
    rowActions: ticketRowActions,
    guards: {
      new: async (_ctx, { body }) => {
        await refreshSlaHours();
        await assertSiteOfCustomer(body.customer, body.site);
      },
      edit: async (_ctx, { id, body, current }) => {
        await refreshSlaHours();
        if (body.customer !== undefined || body.site !== undefined) {
          await assertSiteOfCustomer(
            body.customer ?? current.customer,
            body.site === undefined ? current.site : body.site,
          );
        }
        if (body.status === undefined) return undefined;
        if (isClosing(body.status) && !isClosing(current.status))
          return () => logTicketResolved(id);
        if (!isClosing(body.status) && isClosing(current.status))
          return () => logTicketReopened(id);
        return undefined;
      },
    },
  });

  /**
   * The four figures above the desk. The "resolved" link opens the "all" tab,
   * resolved and closed alike, so a status tab remembered from an earlier
   * visit cannot narrow the view.
   */
  @Get("stats")
  async stats() {
    const tickets = await GetModel(TicketModel).getAll();
    await refreshSlaHours();
    const link = (view: string) =>
      tableViewLink(PageHelioService, "table", { view });
    return {
      items: serviceStats(
        tickets,
        {
          open: link("open"),
          urgent: link("urgent"),
          breaching: link("breaching"),
          resolved: tableViewLink(PageHelioService, "table", {
            tab: "all",
            view: "resolved-recently",
          }),
        },
        slaHours("urgent"),
      ),
    };
  }

  /**
   * The "Assign to…" confirmation, listing the team's ticket holders as they
   * are now (see assignDialog).
   */
  @Get("assign-confirm")
  async assignConfirm(
    @Context() ctx: RequestContext,
    @AuthUser() user: User,
  ): Promise<ConfirmDialogSerialized> {
    await assertCanWriteTickets(ctx, user);
    return serializeConfirmDialog(assignDialog(await ticketHolders()));
  }
}

setTicketWriteAction(PageHelioService.table.getAction("edit"));

/** The desk table's `list` action, which the menu badge count requires. */
const listTickets = PageHelioService.table.getAction("list");
PageHelioService.table.navBadge({
  count: async (ctx, user) => {
    await assertCanRun(listTickets, ctx, user);
    const open = (await GetModel(TicketModel).getAll()).filter(
      (ticket) => !ticket.resolvedAt,
    );
    const fresh = open.some((ticket) => ticket.status === "new");
    return { count: open.length, tone: fresh ? "warning" : "info" };
  },
});

QuickAction("helio-new-ticket", {
  category: helioQuickActions,
  displayName: "$helio.service.quickActions.newTicket",
  icon: "i-ph-lifebuoy",
  target: {
    type: "openForm",
    page: PageHelioService,
    component: PageHelioService.table,
  },
});
