import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import {
  TableView,
  type TableViewView,
} from "@antelopejs/interface-dms/base/table-view";
import { helioOperationsCategory } from "../category";
import { afterProjectEdit } from "./activity-log";
import { PROJECT_PAGE_URL } from "./links";
import { projectController } from "./project-controller";
import {
  assertEndAfterStart,
  assertQuoteOfCustomer,
  assertUniqueCode,
} from "./project-rules";

/**
 * The filter for projects not finished yet, those still ahead of the crew: the
 * planning leaves out what is finished.
 */
const NOT_DONE = { accessorKey: "status", mode: "is_not", value: "done" };

/**
 * Ways of looking at the installations. The planning groups the coming weeks
 * (and the last two, still being finished) by week of start; the others are
 * the questions an operations manager asks every morning.
 */
const PROJECT_VIEWS: TableViewView[] = [
  {
    id: "planning",
    label: "$helio.projects.views.planning",
    icon: "i-ph-calendar-dots",
    display: "grouped",
    filters: [
      NOT_DONE,
      {
        accessorKey: "plannedStart",
        mode: "greater_than",
        value: "{{now-14d}}",
      },
    ],
    sort: [{ field: "plannedStart", desc: false }],
  },
  {
    id: "this-week",
    label: "$helio.projects.views.thisWeek",
    icon: "i-ph-calendar-check",
    tone: "primary",
    count: true,
    display: "table",
    filters: [
      {
        accessorKey: "plannedStart",
        mode: "is_between",
        value: "{{now}},{{now+7d}}",
      },
    ],
    sort: [{ field: "plannedStart", desc: false }],
  },
  {
    id: "on-site",
    label: "$helio.projects.views.onSite",
    icon: "i-ph-hard-hat",
    tone: "primary",
    count: true,
    display: "table",
    filters: [{ accessorKey: "status", mode: "is", value: "in_progress" }],
    sort: [{ field: "plannedEnd", desc: false }],
  },
  {
    id: "late",
    label: "$helio.projects.views.late",
    icon: "i-ph-warning-circle",
    tone: "error",
    count: true,
    display: "table",
    filters: [
      NOT_DONE,
      { accessorKey: "plannedEnd", mode: "less_than", value: "{{now}}" },
    ],
    sort: [{ field: "plannedEnd", desc: false }],
  },
  {
    id: "on-hold",
    label: "$helio.projects.views.onHold",
    icon: "i-ph-pause-circle",
    tone: "warning",
    count: true,
    display: "table",
    filters: [{ accessorKey: "status", mode: "is", value: "on_hold" }],
  },
  {
    id: "board",
    label: "$helio.projects.views.board",
    icon: "i-ph-kanban",
    display: "kanban",
  },
  {
    id: "all",
    label: "$helio.projects.views.all",
    icon: "i-ph-list-bullets",
    display: "table",
    sort: [{ field: "plannedStart", desc: true }],
  },
];

/** The projects list page of the Operations category. */
@RegisterPage()
export class PageHelioProjects extends PageController(
  "projects",
  {
    displayName: "$helio.projects.page.title",
    description: "$helio.projects.page.description",
    icon: "i-ph-solar-panel",
    category: helioOperationsCategory,
    order: 0,
  },
  DefaultLayout({ fullWidth: true }),
) {
  /**
   * The table of projects, which the detail page reuses for its permissions.
   * It lists by ascending start, since the grouped display ignores a view's
   * sort and the planning reads from this week onwards. `?customer=<id>` (a
   * customer's "See projects") lists that customer's projects, shown as a
   * removable chip. A project already on site or finished carries its history
   * (tasks, invoices, a monitored site), so only one planned, scheduled or on
   * hold may be deleted. Every write keeps one project per code and an end on
   * or after the start (an edit may send only one of the dates), and a project
   * moved on site or to done reaches the activity feed.
   */
  static table = TableView(projectController, {
    caption: "$helio.projects.table.caption",
    labelKey: "name",
    searchPlaceholder: "$helio.projects.table.search",
    rowClick: "single",
    pageSize: 25,
    displays: [{ id: "grouped" }, { id: "table" }, { id: "kanban" }],
    defaultDisplay: "grouped",
    grouped: {
      groupByField: "plannedStart",
      by: "week",
      collapsible: true,
      count: true,
    },
    kanban: { groupByField: "status" },
    card: { fields: ["customer", "plannedStart", "leadTechnician"] },
    defaultSort: { field: "plannedStart", desc: false },
    views: { items: PROJECT_VIEWS, defaultView: "planning", userViews: true },
    queryParamFilters: {
      customer: {
        field: "customer",
        mode: "is",
        visible: true,
        label: "$helio.projects.table.filters.customer",
      },
    },
    quickFilters: [
      { field: "type", label: "$helio.projects.table.quickFilters.type" },
      {
        field: "leadTechnician",
        label: "$helio.projects.table.quickFilters.lead",
      },
    ],
    footer: {
      countLabel: "$helio.projects.table.count",
      summary: [
        {
          label: "$helio.projects.table.summary.budget",
          field: "budget",
          op: "sum",
        },
        {
          label: "$helio.projects.table.summary.capacity",
          field: "capacityKwp",
          op: "sum",
          format: { maximumFractionDigits: 1 },
        },
      ],
      legend: "status",
    },
    emptyStates: {
      firstRun: {
        title: "$helio.projects.table.empty.firstRunTitle",
        description: "$helio.projects.table.empty.firstRunDescription",
        icon: "i-ph-solar-panel",
      },
      filtered: {
        title: "$helio.projects.table.empty.filteredTitle",
        description: "$helio.projects.table.empty.filteredDescription",
        icon: "i-ph-calendar-x",
      },
    },
    formContainer: {
      type: "drawer",
      pages: {
        new: {
          displayName: "$helio.projects.form.newTitle",
          description: "$helio.projects.form.newDescription",
        },
        edit: { displayName: "$helio.projects.form.editTitle" },
        details: { displayName: "$helio.projects.form.detailsTitle" },
      },
    },
    rowActions: {
      add: { isEnabled: true, label: "$helio.projects.table.add" },
      edit: true,
      duplicate: true,
      hasSelection: true,
      delete: {
        isEnabled: true,
        rule: { field: "status", in: ["planned", "scheduled", "on_hold"] },
        confirm: {
          title: "$helio.projects.table.deleteConfirm.title",
          description: "$helio.projects.table.deleteConfirm.description",
          confirmLabel: "$helio.projects.table.deleteConfirm.confirm",
          color: "error",
        },
      },
      menuLabel: "$helio.projects.table.menuLabel",
      custom: [
        {
          id: "open",
          label: "$helio.projects.table.open",
          icon: "i-ph-arrow-square-out",
          isDefault: true,
          target: { type: "page", url: `${PROJECT_PAGE_URL}/{{row._id}}` },
        },
      ],
    },
    guards: {
      new: async (_ctx, { body }) => {
        assertEndAfterStart(body.plannedStart, body.plannedEnd);
        await assertUniqueCode(body.code);
        await assertQuoteOfCustomer(body.customer, body.quote);
      },
      edit: async (_ctx, { id, body, current }) => {
        assertEndAfterStart(
          body.plannedStart ?? current.plannedStart,
          body.plannedEnd ?? current.plannedEnd,
        );
        if (body.code !== undefined) await assertUniqueCode(body.code, id);
        if (body.customer !== undefined || body.quote !== undefined) {
          await assertQuoteOfCustomer(
            body.customer ?? current.customer,
            body.quote === undefined ? current.quote : body.quote,
          );
        }
        return afterProjectEdit(id, body.status, current.status);
      },
    },
  });
}
