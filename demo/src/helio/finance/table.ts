import type { Action } from "@antelopejs/interface-dms/component";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  ResourceForm,
  TableView,
  type TableViewTab,
  type TableViewView,
} from "@antelopejs/interface-dms/base/table-view";
import type { CustomRowAction } from "@antelopejs/interface-dms/base/types/row-action";
import { pageRoutePath } from "@antelopejs/interface-dms/page";
import { logInvoicePaid } from "./actions";
import {
  INVOICE_STATUSES,
  invoiceController,
  type InvoiceRow,
  PAYMENT_METHODS,
} from "./controller";
import { assertUniqueNumber } from "./numbering";

/** URL of the Invoices page, under which its own routes are served. */
export const INVOICES_PAGE_PATH = "helio/invoices";
/** Published when invoices change outside the table's own routes. */
export const INVOICES_TOPIC = "helio.invoices";

const pageRoute = (route: string) => pageRoutePath(INVOICES_PAGE_PATH, route);

/** One tab per status; the overdue count also becomes the sidebar badge. */
const STATUS_TABS: TableViewTab[] = INVOICE_STATUSES.map((status) => ({
  id: status.value,
  label: status.label,
  icon: status.icon,
  iconColor: status.iconColor,
  textColor: status.textColor,
  filter: { accessorKey: "status", value: status.value, mode: "is" },
  navBadge: status.value === "overdue" ? { tone: "error" } : undefined,
}));

/**
 * Ways the accounts team looks at the ledger. Filter tokens are resolved by
 * the server on every request, so "this week" always means this week. The
 * "outstanding" view lists every issued invoice still to be paid, on time or
 * late, which is what the "Outstanding" KPI adds up (drafts are not issued
 * yet).
 */
const VIEWS: TableViewView[] = [
  {
    id: "outstanding",
    label: "$helio.finance.invoices.views.outstanding",
    icon: "i-ph-hourglass-medium",
    tone: "info",
    count: true,
    filters: [
      { accessorKey: "status", mode: "is_not", value: "draft" },
      { accessorKey: "amountDue", mode: "greater_than", value: "0" },
    ],
    sort: [{ field: "dueAt" }],
  },
  {
    id: "due-this-week",
    label: "$helio.finance.invoices.views.dueThisWeek",
    icon: "i-ph-calendar-dots",
    tone: "warning",
    count: true,
    filters: [
      { accessorKey: "status", mode: "is", value: "sent" },
      { accessorKey: "dueAt", mode: "is_between", value: "{{now}},{{now+7d}}" },
    ],
    sort: [{ field: "dueAt" }],
  },
  {
    id: "overdue-30",
    label: "$helio.finance.invoices.views.overdue30",
    icon: "i-ph-siren",
    tone: "error",
    count: true,
    filters: [
      { accessorKey: "status", mode: "is", value: "overdue" },
      { accessorKey: "dueAt", mode: "less_than", value: "{{now-30d}}" },
    ],
    sort: [{ field: "dueAt" }],
  },
  {
    id: "paid-recently",
    label: "$helio.finance.invoices.views.paidRecently",
    icon: "i-ph-hand-coins",
    tone: "success",
    count: true,
    filters: [
      { accessorKey: "status", mode: "is", value: "paid" },
      { accessorKey: "paidAt", mode: "greater_than", value: "{{now-30d}}" },
    ],
    sort: [{ field: "paidAt", desc: true }],
    columns: { visible: ["paidAt"] },
  },
];

/** Records a payment, for one invoice or for the whole selection. */
const markPaidAction: CustomRowAction<InvoiceRow> = {
  id: "mark-paid",
  label: "$helio.finance.invoices.markPaid.action",
  icon: "i-ph-check-circle",
  color: "success",
  permission: "edit",
  bulk: true,
  rule: { field: "status", in: ["sent", "overdue"] },
  /** `{{row._id}}` is empty on the selection bar, which appends the ids. */
  target: {
    type: "api",
    method: "POST",
    url: pageRoute("/mark-paid?ids={{row._id}}"),
    successMessage: "$helio.finance.invoices.markPaid.success",
  },
  /**
   * Worded by the server so the payment date starts on today's date, the day
   * the dialog opens rather than the day the page was declared.
   */
  confirm: { from: pageRoute("/mark-paid-confirm?ids={{row._id}}") },
};

/**
 * A credit note cancels an issued invoice: nothing left to pay, the number
 * stays used, and the invoice can then be archived or deleted.
 */
const cancelAction: CustomRowAction<InvoiceRow> = {
  id: "cancel",
  label: "$helio.finance.invoices.cancel.action",
  icon: "i-ph-prohibit",
  color: "error",
  permission: "edit",
  rule: { field: "status", in: ["sent", "overdue"] },
  target: {
    type: "api",
    method: "POST",
    url: pageRoute("/cancel?ids={{row._id}}"),
    successMessage: "$helio.finance.invoices.cancel.success",
  },
  confirm: {
    title: "$helio.finance.invoices.cancel.title",
    description: "$helio.finance.invoices.cancel.description",
    icon: "i-ph-prohibit",
    color: "error",
    confirmLabel: "$helio.finance.invoices.cancel.confirm",
    impact: [
      {
        icon: "i-ph-receipt-x",
        label: "$helio.finance.invoices.cancel.impactCredit",
      },
      {
        icon: "i-ph-lock-simple",
        label: "$helio.finance.invoices.cancel.impactLocked",
      },
    ],
  },
};

/** The fields of the "Mark as paid" dialog: the payment date starts today. */
export function markPaidFields(today: Date) {
  return [
    {
      id: "paymentMethod",
      label: "$helio.finance.invoices.columns.paymentMethod",
      type: new DefaultDataTypes.SelectType({ items: [...PAYMENT_METHODS] }),
      required: true,
      defaultValue: "transfer",
    },
    {
      id: "paidAt",
      label: "$helio.finance.invoices.markPaid.paidAt",
      hint: "$helio.finance.invoices.markPaid.paidAtHint",
      type: new DefaultDataTypes.DateType(),
      defaultValue: today,
    },
  ];
}

/** Sends a payment reminder for the overdue invoices selected. */
const remindAction: CustomRowAction<InvoiceRow> = {
  id: "remind",
  label: "$helio.finance.invoices.remind.action",
  icon: "i-ph-envelope-simple",
  color: "warning",
  permission: "edit",
  bulk: true,
  rule: { field: "status", equals: "overdue" },
  target: {
    type: "api",
    method: "POST",
    url: pageRoute("/remind?ids={{row._id}}"),
    successMessage: "$helio.finance.invoices.remind.success",
  },
  confirm: {
    title: "$helio.finance.invoices.remind.title",
    description: "$helio.finance.invoices.remind.description",
    icon: "i-ph-envelope-simple",
    color: "warning",
    confirmLabel: "$helio.finance.invoices.remind.confirm",
    impact: [
      {
        icon: "i-ph-at",
        label: "$helio.finance.invoices.remind.impactEmail",
      },
      {
        icon: "i-ph-clock-counter-clockwise",
        label: "$helio.finance.invoices.remind.impactStamp",
      },
    ],
  },
};

/** Downloads the invoice document served by the page's `document` route. */
const downloadAction: CustomRowAction<InvoiceRow> = {
  id: "download",
  label: "$helio.finance.invoices.download",
  icon: "i-ph-file-arrow-down",
  target: {
    type: "download",
    url: pageRoute("/{{row._id}}/document"),
    filename: "{{row.number}}.html",
  },
};

/**
 * A click on an invoice, its "Quick view" and `?record=<invoice id>` (the
 * dashboard's activity feed, a project's invoicing tab) open the invoice
 * read-only in a right drawer; J / K walk the invoices.
 */
const quickViewAction: CustomRowAction<InvoiceRow> = {
  id: "quick-view",
  label: "$helio.finance.invoices.quickView.action",
  icon: "i-ph-sidebar-simple",
  isDefault: true,
  target: {
    type: "drawer",
    direction: "right",
    title: "$helio.finance.invoices.quickView.title",
    description: "$helio.finance.invoices.quickView.description",
    rowTitle: "{number}",
    positionLabel: "$helio.finance.invoices.quickView.position",
    deepLink: true,
    notFound: {
      title: "$helio.finance.invoices.quickView.notFoundTitle",
      description: "$helio.finance.invoices.quickView.notFoundDescription",
    },
    component: ResourceForm(invoiceController, {
      mode: "view",
      rowId: "{{row._id}}",
    }),
  },
};

const NOT_ARCHIVED = { field: "isArchived", notEquals: true } as const;

/**
 * The invoice list of the Invoices page: status tabs, saved views, footer
 * totals, and row rules that follow accounting practice. An issued invoice is
 * never deleted (a credit note corrects it, so only a draft or a cancelled
 * invoice may go), a paid or cancelled one is never edited, and only settled
 * invoices are archived. A `?customer=<id>` query parameter, set from the
 * customers page, narrows the list and shows as a chip. A copy would carry
 * the original's number, so rows are not duplicated and a new invoice starts
 * blank; the quick view already shows an invoice, so no bottom sheet comes
 * besides it. The guards keep numbers unique, and an invoice marked paid from
 * its form reaches the activity feed, as one paid through the "Mark as paid"
 * action does.
 */
export const invoicesTable = TableView(invoiceController, {
  caption: "$helio.finance.invoices.caption",
  searchPlaceholder: "$helio.finance.invoices.search",
  labelKey: "number",
  rowClick: "single",
  archiveMode: true,
  realtimeTopic: INVOICES_TOPIC,
  pagination: "pages",
  pageSize: 25,
  defaultSort: { field: "issuedAt", desc: true },
  tabs: STATUS_TABS,
  views: { layout: "strip", userViews: true, items: VIEWS },
  queryParamFilters: {
    customer: {
      field: "customer",
      visible: true,
      label: "$helio.finance.invoices.customerChip",
    },
  },
  quickFilters: [
    {
      field: "paymentMethod",
      label: "$helio.finance.invoices.columns.paymentMethod",
    },
  ],
  formContainer: {
    type: "drawer",
    pages: {
      new: {
        displayName: "$helio.finance.invoices.form.new",
        description: "$helio.finance.invoices.form.newDescription",
      },
      edit: { displayName: "$helio.finance.invoices.form.edit" },
      details: { displayName: "$helio.finance.invoices.form.details" },
    },
  },
  footer: {
    countLabel: "$helio.finance.invoices.footer.count",
    summary: [
      {
        label: "$helio.finance.invoices.footer.invoiced",
        op: "sum",
        field: "total",
        where: { field: "status", notIn: ["draft", "cancelled"] },
      },
      {
        label: "$helio.finance.invoices.footer.due",
        op: "sum",
        field: "amountDue",
        where: { field: "status", in: ["sent", "overdue"] },
      },
      {
        label: "$helio.finance.invoices.footer.overdue",
        op: "sum",
        field: "amountDue",
        where: { field: "status", equals: "overdue" },
      },
    ],
    legend: "status",
  },
  emptyStates: {
    firstRun: {
      title: "$helio.finance.invoices.empty.title",
      description: "$helio.finance.invoices.empty.description",
      icon: "i-ph-receipt",
    },
    filtered: {
      title: "$helio.finance.invoices.empty.filteredTitle",
      description: "$helio.finance.invoices.empty.filteredDescription",
      icon: "i-ph-funnel-x",
    },
  },
  rowActions: {
    add: true,
    duplicate: false,
    details: false,
    hasSelection: true,
    edit: {
      isEnabled: true,
      rule: {
        and: [NOT_ARCHIVED, { field: "status", notIn: ["paid", "cancelled"] }],
      },
    },
    delete: {
      isEnabled: true,
      rule: { field: "status", in: ["draft", "cancelled"] },
      successMessage: "$helio.finance.invoices.deleted",
    },
    archive: {
      isEnabled: true,
      rule: {
        and: [NOT_ARCHIVED, { field: "status", in: ["paid", "cancelled"] }],
      },
    },
    restore: true,
    custom: [
      quickViewAction,
      downloadAction,
      markPaidAction,
      remindAction,
      cancelAction,
    ],
  },
  guards: {
    new: async (_ctx, { body }) => {
      await assertUniqueNumber(body.number);
    },
    edit: async (_ctx, { id, body }) => {
      if (body.number !== undefined) await assertUniqueNumber(body.number, id);
      return body.status === "paid" ? () => logInvoicePaid(id) : undefined;
    },
  },
});

function requireAction(id: string): Action {
  const action = invoicesTable.getAction(id);
  if (!action) throw new Error(`The invoice table has no "${id}" action`);
  return action;
}

/** The table's permissions, guarding the page routes that act like them. */
export const invoiceListAction = requireAction("list");
export const invoiceEditAction = requireAction("edit");
