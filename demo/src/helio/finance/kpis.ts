import { GetModel } from "@antelopejs/interface-database-decorators";
import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { ComposedText } from "@antelopejs/interface-dms/base/types/composed-text";
import { DAY_MS } from "../shared/seed";
import { type Invoice, InvoiceModel } from "./database";
import { daysLate } from "./due";
import { helioNow } from "../shared/clock";

/**
 * Window of "Collected": the days the "Paid in the last 30 days" view it
 * links to lists (a view filter moves by whole days, never to the 1st).
 */
const COLLECTED_WINDOW_DAYS = 30;
/** Window of the DSO: receivables over the sales of the last 90 days. */
const DSO_WINDOW_DAYS = 90;
const NOT_BILLED: readonly string[] = ["draft", "cancelled"];

/** Where the cells lead: tabs and views of the invoice table. */
export interface KpiLinks {
  overdue: string;
  /** The view listing every issued invoice still to be paid. */
  outstanding: string;
  paid: string;
}

const money = (euros: number): ComposedText => ({
  key: "$helio.finance.kpis.amount",
  params: {
    amount: { type: "money", value: Math.round(euros * 100), currency: "EUR" },
  },
});

const sum = (invoices: Invoice[], pick: (invoice: Invoice) => number) =>
  invoices.reduce((total, invoice) => total + pick(invoice), 0);

function outstandingCell(invoices: Invoice[], to: string): StatGroupItem {
  const open = invoices.filter((invoice) =>
    ["sent", "overdue"].includes(invoice.status),
  );
  return {
    id: "outstanding",
    icon: "i-ph-hourglass-medium",
    tone: "info",
    eyebrow: "$helio.finance.kpis.outstanding.label",
    value: money(sum(open, (invoice) => invoice.amountDue)),
    detail: {
      key: "$helio.finance.kpis.outstanding.detail",
      params: { count: { type: "count", value: open.length } },
    },
    to,
  };
}

function overdueCell(invoices: Invoice[], to: string): StatGroupItem {
  const late = invoices.filter((invoice) => invoice.status === "overdue");
  const oldest = late.reduce(
    (days, invoice) => Math.max(days, daysLate(invoice.dueAt)),
    0,
  );
  return {
    id: "overdue",
    icon: "i-ph-warning-circle",
    tone: late.length > 0 ? "error" : "success",
    eyebrow: "$helio.finance.kpis.overdue.label",
    value: money(sum(late, (invoice) => invoice.amountDue)),
    detail:
      late.length > 0
        ? {
            key: "$helio.finance.kpis.overdue.detail",
            params: {
              count: { type: "count", value: late.length },
              days: { type: "number", value: oldest },
            },
          }
        : "$helio.finance.kpis.overdue.none",
    detailTone: late.length > 0 ? "error" : "success",
    to,
  };
}

function collectedCell(invoices: Invoice[], to: string): StatGroupItem {
  const since = helioNow() - COLLECTED_WINDOW_DAYS * DAY_MS;
  const paid = invoices.filter(
    (invoice) =>
      invoice.status === "paid" &&
      !!invoice.paidAt &&
      invoice.paidAt.getTime() > since,
  );
  return {
    id: "collected",
    icon: "i-ph-hand-coins",
    tone: "success",
    eyebrow: "$helio.finance.kpis.collected.label",
    value: money(sum(paid, (invoice) => invoice.total)),
    detail: {
      key: "$helio.finance.kpis.collected.detail",
      params: { count: { type: "count", value: paid.length } },
    },
    to,
  };
}

/**
 * Days sales outstanding: receivables over the sales of the window, times the
 * days of the window. The detail names the two amounts of that division, so
 * the figure can be checked, where an average of payment delays would read as
 * a second, contradicting figure. The receivable is written like the cards'
 * amounts and reads the same as "Outstanding".
 */
function dsoCell(invoices: Invoice[]): StatGroupItem {
  const since = helioNow() - DSO_WINDOW_DAYS * DAY_MS;
  const billed = invoices.filter(
    (invoice) =>
      !NOT_BILLED.includes(invoice.status) &&
      invoice.issuedAt.getTime() >= since,
  );
  const receivable = sum(
    invoices.filter((invoice) => ["sent", "overdue"].includes(invoice.status)),
    (invoice) => invoice.amountDue,
  );
  const sales = sum(billed, (invoice) => invoice.total);
  const dso =
    sales > 0 ? Math.round((receivable / sales) * DSO_WINDOW_DAYS) : 0;
  return {
    id: "dso",
    icon: "i-ph-calendar-check",
    tone: "primary",
    eyebrow: "$helio.finance.kpis.dso.label",
    value: {
      key: "$helio.finance.kpis.dso.value",
      params: { count: { type: "count", value: dso } },
    },
    detail: {
      key: "$helio.finance.kpis.dso.detail",
      params: {
        receivable: money(receivable),
        sales: money(sales),
        days: { type: "number", value: DSO_WINDOW_DAYS },
      },
    },
  };
}

/**
 * The four cells of the invoice KPI strip: what customers still owe, what is
 * late, what came in over the last 30 days and how long payment takes (DSO).
 * They are computed from the stored invoices on every read, so they follow
 * each payment recorded. Archived invoices are left out: the list the cells
 * open hides them (archive mode), so a card counting one would announce a row
 * the list never shows.
 */
export async function invoiceKpis(links: KpiLinks): Promise<StatGroupItem[]> {
  const invoices = (await GetModel(InvoiceModel).getAll()).filter(
    (invoice) => !invoice.isArchived,
  );
  return [
    outstandingCell(invoices, links.outstanding),
    overdueCell(invoices, links.overdue),
    collectedCell(invoices, links.paid),
    dsoCell(invoices),
  ];
}
