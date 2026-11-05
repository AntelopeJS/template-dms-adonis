import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  ResourceForm,
  type TableViewFooterOptions,
  type TableViewRowActionOptions,
  type TableViewTab,
  type TableViewViewsOptions,
} from "@antelopejs/interface-dms/base/table-view";
import type { ConfirmDialog } from "@antelopejs/interface-dms/base/types/confirm-dialog";
import type { CustomRowAction } from "@antelopejs/interface-dms/base/types/row-action";
import { pageRoutePath } from "@antelopejs/interface-dms/page";
import type { TeamMember } from "../team/database";
import { ticketController, type TicketRow } from "./controller";
import { SERVICE_DESK_PATH, TICKET_STATUSES } from "./options";

/** Base path of the tickets data controller, which the bulk routes hang from. */
const TICKETS_API = "/api/helio/tickets";

/**
 * A ticket is still open while nobody resolved it: `resolvedAt` is stamped
 * exactly when it is resolved or closed, and a select column cannot filter on
 * "one of new, open, waiting" in one filter.
 */
const STILL_OPEN = {
  accessorKey: "resolvedAt",
  mode: "is_empty",
} as const;

/**
 * The saved views of the desk. "Breaching" lists the tickets still open past
 * the promised resolution time, whoever holds them. "Resolved recently" lists
 * the tickets the "Average resolution" figure is computed from: resolved or
 * closed within the last 30 days.
 */
export const ticketViews: TableViewViewsOptions = {
  layout: "strip",
  defaultView: "all",
  userViews: true,
  items: [
    { id: "all", label: "$helio.service.views.all", icon: "i-ph-tray" },
    {
      id: "open",
      label: "$helio.service.views.open",
      icon: "i-ph-wrench",
      count: true,
      filters: [STILL_OPEN],
    },
    {
      id: "urgent",
      label: "$helio.service.views.urgent",
      icon: "i-ph-fire",
      tone: "error",
      count: true,
      filters: [
        STILL_OPEN,
        { accessorKey: "priority", mode: "is", value: "urgent" },
      ],
      sort: [{ field: "slaDueAt" }],
    },
    {
      id: "unassigned",
      label: "$helio.service.views.unassigned",
      icon: "i-ph-user-circle-dashed",
      tone: "warning",
      count: true,
      filters: [STILL_OPEN, { accessorKey: "assignee", mode: "is_empty" }],
      sort: [{ field: "slaDueAt" }],
    },
    {
      id: "waiting",
      label: "$helio.service.views.waiting",
      icon: "i-ph-hourglass-medium",
      count: true,
      filters: [{ accessorKey: "status", mode: "is", value: "waiting" }],
    },
    {
      id: "breaching",
      label: "$helio.service.views.breaching",
      icon: "i-ph-alarm",
      tone: "error",
      count: true,
      filters: [
        STILL_OPEN,
        { accessorKey: "slaDueAt", mode: "less_than", value: "{{now}}" },
      ],
      sort: [{ field: "slaDueAt" }],
    },
    {
      id: "resolved-recently",
      label: "$helio.service.views.resolvedRecently",
      icon: "i-ph-timer",
      tone: "info",
      count: true,
      filters: [
        {
          accessorKey: "resolvedAt",
          mode: "greater_than",
          value: "{{now-30d}}",
        },
      ],
      sort: [{ field: "resolvedAt", desc: true }],
      columns: { visible: ["resolvedAt"] },
    },
  ],
};

/** One tab per status. */
export const ticketTabs: TableViewTab[] = TICKET_STATUSES.map((status) => ({
  id: status.value,
  label: status.label,
  icon: status.icon,
  iconColor: status.iconColor,
  textColor: status.textColor,
  filter: { accessorKey: "status", value: status.value, mode: "is" },
}));

/** The footer of the desk: the open urgent and the waiting tickets, and the status legend. */
export const ticketFooter: TableViewFooterOptions<TicketRow> = {
  countLabel: "$helio.service.table.count",
  summary: [
    {
      label: "$helio.service.table.footer.urgent",
      op: "count",
      where: {
        and: [
          { field: "priority", equals: "urgent" },
          { field: "status", notIn: ["resolved", "closed"] },
        ],
      },
    },
    {
      label: "$helio.service.table.footer.waiting",
      op: "count",
      where: { field: "status", equals: "waiting" },
    },
  ],
  legend: "status",
};

/**
 * The bulk routes take the selection as `?ids=`. On a single row the
 * selection bar's query is missing, so the row's own id is named; on the bar
 * that token reaches the route unresolved, and the route skips any id that
 * names no ticket.
 */
const BULK_ROW_IDS = "?ids={{row._id}}";

/**
 * The "Assign to…" confirmation, listing the people who may hold a ticket.
 * The desk words it per request (its `assign-confirm` route) from the team
 * rows, so a technician added since the server started is offered too. The
 * names are people, so they are not translated.
 */
export function assignDialog(holders: readonly TeamMember[]): ConfirmDialog {
  return {
    title: "$helio.service.bulk.assign.title",
    description: "$helio.service.bulk.assign.description",
    icon: "i-ph-user-switch",
    color: "primary",
    confirmLabel: "$helio.service.bulk.assign.confirm",
    fields: [
      {
        id: "assignee",
        label: "$helio.service.bulk.assign.field",
        type: new DefaultDataTypes.SelectType({
          items: holders.map(({ _id, name }) => ({ value: _id, label: name })),
          placeholder: "$helio.service.bulk.assign.placeholder",
        }),
        required: true,
      },
    ],
  };
}

/** The bulk "Assign to…" action, confirmed with the dialog the page serves. */
const assignAction: CustomRowAction<TicketRow> = {
  label: "$helio.service.actions.assign",
  icon: "i-ph-user-switch",
  permission: "edit",
  bulk: { allMatching: true },
  confirm: { from: pageRoutePath(SERVICE_DESK_PATH, "/assign-confirm") },
  target: {
    type: "api",
    url: `${TICKETS_API}/bulk/assign${BULK_ROW_IDS}`,
    method: "POST",
    successMessage: "$helio.service.bulk.assign.done",
  },
};

/** The bulk "Resolve" action, offered on tickets that are not resolved or closed yet. */
const resolveAction: CustomRowAction<TicketRow> = {
  label: "$helio.service.actions.resolve",
  icon: "i-ph-check-circle",
  color: "success",
  permission: "edit",
  bulk: { allMatching: true },
  rule: { field: "status", notIn: ["resolved", "closed"] },
  confirm: {
    title: "$helio.service.bulk.resolve.title",
    description: "$helio.service.bulk.resolve.description",
    icon: "i-ph-check-circle",
    color: "success",
    confirmLabel: "$helio.service.bulk.resolve.confirm",
  },
  target: {
    type: "api",
    url: `${TICKETS_API}/bulk/resolve${BULK_ROW_IDS}`,
    method: "POST",
    successMessage: "$helio.service.bulk.resolve.done",
  },
};

/** The bulk "Reopen" action, offered on resolved or closed tickets. */
const reopenAction: CustomRowAction<TicketRow> = {
  label: "$helio.service.actions.reopen",
  icon: "i-ph-arrow-counter-clockwise",
  permission: "edit",
  bulk: { allMatching: true },
  rule: { field: "status", in: ["resolved", "closed"] },
  confirm: {
    title: "$helio.service.bulk.reopen.title",
    description: "$helio.service.bulk.reopen.description",
    icon: "i-ph-arrow-counter-clockwise",
    color: "warning",
    confirmLabel: "$helio.service.bulk.reopen.confirm",
  },
  target: {
    type: "api",
    url: `${TICKETS_API}/bulk/reopen${BULK_ROW_IDS}`,
    method: "POST",
    successMessage: "$helio.service.bulk.reopen.done",
  },
};

/**
 * A click on a ticket (or `?record=<ticket id>`, the dashboard's activity feed)
 * opens it read-only in a right drawer: J / K walk the tickets, "Modifier"
 * from the row menu opens the edit form. Its form reads the ticket from the
 * URL, so the drawer keeps it there.
 */
const quickViewAction: CustomRowAction<TicketRow> = {
  id: "quick-view",
  label: "$helio.service.quickView.action",
  icon: "i-ph-sidebar-simple",
  isDefault: true,
  target: {
    type: "drawer",
    direction: "right",
    title: "$helio.service.quickView.title",
    rowTitle: "{number} · {subject}",
    positionLabel: "$helio.service.quickView.position",
    deepLink: true,
    notFound: {
      title: "$helio.service.quickView.notFoundTitle",
      description: "$helio.service.quickView.notFoundDescription",
    },
    component: ResourceForm(ticketController, {
      mode: "view",
      rowId: "{{row._id}}",
    }),
  },
};

/** The row actions of the desk: the custom ones above, besides add, edit and delete. */
export const ticketRowActions: TableViewRowActionOptions<TicketRow> = {
  add: true,
  edit: true,
  /** The quick view shows a ticket: no bottom sheet besides it. */
  details: false,
  duplicate: false,
  /**
   * A ticket still open is worked on, not deleted: once resolved or closed it
   * can go (a test ticket, a duplicate call), from its menu or the selection
   * bar.
   */
  delete: {
    isEnabled: true,
    rule: { field: "status", in: ["resolved", "closed"] },
    confirm: {
      title: "$helio.service.delete.title",
      description: "$helio.service.delete.description",
      icon: "i-ph-trash",
      color: "error",
      confirmLabel: "$helio.service.delete.confirm",
    },
  },
  hasSelection: true,
  custom: [quickViewAction, assignAction, resolveAction, reopenAction],
};
