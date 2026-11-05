import {
  ActivityFeed,
  BlockFunctions,
  Card,
  type FormBuilder,
  FormEvents,
  FormFunctions,
  Grid,
  GridRow,
  KeyValueList,
  Meter,
  ResourceForm,
  ROUTE_PARAM_ROW_ID,
  TableView,
} from "@antelopejs/interface-dms/base";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { invoiceController } from "../finance/controller";
import { projectDetailRoute } from "./links";
import { projectController } from "./project-controller";
import { HELIO_PROJECT_TOPICS } from "./topics";
import { projectTaskController } from "./task-controller";
import { newProjectTaskGuard } from "./task-guards";

/**
 * Facts on the left, progress and the customer contact on the right. Like the
 * other panels of the tab set, every block reads its data from a detail route
 * scoped by `{{params.id}}`, and the tables are scoped the same way through
 * `routeParamFilters`.
 */
export function overviewPanel() {
  return Grid({ minColumnWidth: "300px" }).child(
    "row",
    GridRow()
      .child(
        "facts",
        KeyValueList({
          title: "$helio.projects.detail.overview.facts",
          fetchUrl: projectDetailRoute("facts"),
          realtimeTopic: HELIO_PROJECT_TOPICS,
          columns: 2,
          currency: "EUR",
          skeletonCount: 12,
        }),
        { colSpan: 2 },
      )
      .child(
        "progress",
        Card({ title: "$helio.projects.detail.overview.progress" })
          .child(
            "tasks",
            Meter({
              label: "$helio.projects.detail.progress.label",
              fetchUrl: projectDetailRoute("progress"),
              realtimeTopic: HELIO_PROJECT_TOPICS,
              legend: true,
              size: "md",
            }),
          )
          .child(
            "invoicing",
            Meter({
              label: "$helio.projects.detail.invoicing.label",
              fetchUrl: projectDetailRoute("invoicing"),
              realtimeTopic: HELIO_PROJECT_TOPICS,
              format: "percent",
              tone: "success",
              size: "sm",
            }),
          )
          .child(
            "contact",
            KeyValueList({
              title: "$helio.projects.detail.overview.contact",
              fetchUrl: projectDetailRoute("contact"),
              card: false,
              dense: true,
              skeletonCount: 4,
            }),
          ),
      ),
  );
}

/**
 * Hides the fields of a task that its forms leave out on the project page: its
 * position, which the drag handle sets, and its project, the page's own
 * (filled from the URL on creation). FIELD_CHANGE fires for every field once
 * the form has loaded, so a watch keyed on the status (which always holds a
 * value, "todo" on a new task) hides them from the start.
 */
function hideTaskFormFields(form: FormBuilder): void {
  for (const field of ["position", "project"]) {
    form.watch(FormEvents.FIELD_CHANGE, FormFunctions.SET_FIELD_HIDDEN, {
      params: { targetField: field, setHidden: true },
      onParam: [{ key: "fieldId", value: "status" }],
    });
  }
}

/**
 * The project's tasks, in the order the crew works through them. The table
 * lists only this project's tasks (`routeParamFilters`), and a task added
 * here belongs to it: the same filter fills its `project`.
 */
export function tasksPanel() {
  return TableView(projectTaskController, {
    caption: "$helio.projects.detail.tasks.caption",
    labelKey: "title",
    searchPlaceholder: "$helio.projects.detail.tasks.search",
    routeParamFilters: { id: { field: "project" } },
    columns: { hidden: ["project"] },
    reorder: { field: "position" },
    displays: [{ id: "table" }, { id: "kanban" }],
    kanban: { groupByField: "status", columnMaxHeight: "50vh" },
    card: { fields: ["assignee", "dueDate", "estimateHours"] },
    pageSize: 50,
    density: "compact",
    footer: {
      countLabel: "$helio.projects.detail.tasks.count",
      summary: [
        {
          label: "$helio.projects.detail.tasks.hours",
          field: "estimateHours",
          op: "sum",
          format: { maximumFractionDigits: 1 },
        },
      ],
      legend: "status",
    },
    emptyStates: {
      firstRun: {
        title: "$helio.projects.detail.tasks.emptyTitle",
        description: "$helio.projects.detail.tasks.emptyDescription",
        icon: "i-ph-list-checks",
      },
    },
    formContainer: {
      type: "drawer",
      pages: {
        new: {
          displayName: "$helio.projects.detail.tasks.newTitle",
          description: "$helio.projects.detail.tasks.newDescription",
        },
        edit: { displayName: "$helio.projects.detail.tasks.editTitle" },
      },
    },
    forms: { new: hideTaskFormFields, edit: hideTaskFormFields },
    guards: { new: newProjectTaskGuard },
    rowActions: {
      add: { isEnabled: true, label: "$helio.projects.detail.tasks.add" },
      edit: true,
      delete: true,
      hasSelection: true,
    },
  });
}

/** What happened on the project, newest first. */
export function activityPanel() {
  return ActivityFeed({
    title: "$helio.projects.detail.activity.title",
    fetchUrl: projectDetailRoute("activity"),
    realtimeTopic: HELIO_PROJECT_TOPICS,
    groupByDay: true,
    wrap: true,
    skeletonCount: 5,
    empty: {
      title: "$helio.projects.detail.activity.emptyTitle",
      description: "$helio.projects.detail.activity.emptyDescription",
    },
  });
}

/**
 * The invoices of the project, read-only: they are issued and cashed from
 * the Invoices page, which holds the one writing table of invoices.
 */
export function invoicesPanel() {
  return TableView(invoiceController, {
    caption: "$helio.projects.detail.invoices.caption",
    labelKey: "number",
    routeParamFilters: { id: { field: "project" } },
    columns: { hidden: ["project", "customer"] },
    defaultSort: { field: "issuedAt", desc: false },
    footer: {
      countLabel: "$helio.projects.detail.invoices.count",
      summary: [
        {
          label: "$helio.projects.detail.invoices.total",
          field: "total",
          op: "sum",
        },
        {
          label: "$helio.projects.detail.invoices.due",
          field: "amountDue",
          op: "sum",
        },
      ],
    },
    emptyStates: {
      firstRun: {
        title: "$helio.projects.detail.invoices.emptyTitle",
        description: "$helio.projects.detail.invoices.emptyDescription",
        icon: "i-ph-receipt",
      },
    },
    formContainer: {
      type: "drawer",
      pages: {
        details: {
          displayName: "$helio.projects.detail.invoices.detailsTitle",
        },
      },
    },
    rowActions: {
      add: false,
      edit: false,
      duplicate: false,
      delete: false,
      archive: false,
      restore: false,
      details: true,
    },
  });
}

/** The signed quote: its facts, then its lines. */
export function quotePanel() {
  return Grid({ minColumnWidth: "320px" })
    .child(
      "facts",
      GridRow().child(
        "quote",
        KeyValueList({
          title: "$helio.projects.detail.quote.title",
          fetchUrl: projectDetailRoute("quote"),
          columns: 3,
          currency: "EUR",
          skeletonCount: 7,
          empty: {
            title: "$helio.projects.detail.quote.emptyTitle",
            description: "$helio.projects.detail.quote.emptyDescription",
          },
        }),
      ),
    )
    .child(
      "lines",
      GridRow().child(
        "lines",
        TableView.fromSource({
          caption: "$helio.projects.detail.quote.linesCaption",
          fetchUrl: projectDetailRoute("quote-lines"),
          labelKey: "label",
          pageSize: 25,
          columns: {
            label: {
              name: "$helio.projects.detail.quote.columns.label",
              type: new DefaultDataTypes.StringType(),
              order: 1,
              size: 420,
            },
            qty: {
              name: "$helio.projects.detail.quote.columns.qty",
              type: new DefaultDataTypes.NumberType(),
              order: 2,
              size: 100,
            },
            unitPrice: {
              name: "$helio.projects.detail.quote.columns.unitPrice",
              type: new DefaultDataTypes.PriceType(),
              order: 3,
              size: 140,
            },
            lineTotal: {
              name: "$helio.projects.detail.quote.columns.lineTotal",
              type: new DefaultDataTypes.PriceType(),
              order: 4,
              size: 140,
            },
          },
          emptyStates: {
            firstRun: {
              title: "$helio.projects.detail.quote.linesEmptyTitle",
              icon: "i-ph-file-dashed",
            },
          },
        }),
      ),
    );
}

/**
 * The project's own form, saved in place. It also names the project at the
 * end of the breadcrumb (`labelKey`), and the rest of the page reads its
 * data again once it saved.
 */
export function detailsPanel() {
  return ResourceForm(projectController, {
    mode: "edit",
    rowId: ROUTE_PARAM_ROW_ID,
    labelKey: "name",
    title: "$helio.projects.detail.details.title",
    description: "$helio.projects.detail.details.description",
  }).watch(FormEvents.SUBMIT_SUCCESS, BlockFunctions.REFRESH_PAGE);
}
