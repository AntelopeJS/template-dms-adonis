import { GetModel } from "@antelopejs/interface-database-decorators";
import { type Invoice, InvoiceModel } from "../finance/database";
import { type Quote, QuoteModel } from "../sales/database";
import { PRODUCT_CATEGORY_ROSTER, PRODUCT_ROSTER } from "../shared/roster";
import type { ReaderLanguage } from "./locale";
import {
  bucketLabel,
  chartBuckets,
  deltaPercent,
  type Period,
  roundAmount,
  shiftBuckets,
  slices,
  sumByRange,
  type TimeRange,
  within,
} from "./period";

export interface KpiPayload {
  value: number;
  previousValue?: number;
  delta: number | null;
  sparkline: number[];
}

export interface ChartPoint {
  x: string;
  y: number;
}

export interface ChartSeriesPayload {
  name: string;
  data: ChartPoint[];
  color?: string;
}

export interface ChartCardPayload {
  value: number;
  previousValue?: number;
  delta: number | null;
  series: ChartSeriesPayload[];
  comparisonSeries?: ChartSeriesPayload[];
}

/** Drafts are not sent yet and cancelled invoices were credited: neither is revenue. */
const BILLED_STATUSES: ReadonlySet<Invoice["status"]> = new Set([
  "sent",
  "overdue",
  "paid",
]);
/** A quote still "sent" awaits the customer: only decided quotes count in the conversion rate. */
const DECIDED_STATUSES: ReadonlySet<Quote["status"]> = new Set([
  "accepted",
  "rejected",
  "expired",
]);

/**
 * The invoices that count as revenue, read from the real collection the
 * Invoices page lists so the dashboard figures match it.
 */
export async function billedInvoices(): Promise<Invoice[]> {
  const invoices = await GetModel(InvoiceModel).getAll();
  return invoices.filter((invoice) => BILLED_STATUSES.has(invoice.status));
}

/**
 * The signed quotes (order intake), read from the real collection the Quotes
 * page lists so the dashboard figures match it.
 */
export async function acceptedQuotes(): Promise<Quote[]> {
  const quotes = await GetModel(QuoteModel).getAll();
  return quotes.filter((quote) => quote.status === "accepted");
}

/** A figure summed over the period, its comparison and its sparkline. */
function summedKpi<T>(
  rows: readonly T[],
  period: Period,
  dateOf: (row: T) => Date | undefined,
  amount: (row: T) => number,
): KpiPayload {
  const [value = 0, previous] = sumByRange(
    rows,
    period.compare ? [period.range, period.compare] : [period.range],
    dateOf,
    amount,
  );
  return {
    value: roundAmount(value),
    previousValue: previous === undefined ? undefined : roundAmount(previous),
    delta: deltaPercent(value, previous),
    sparkline: sumByRange(rows, slices(period.range), dateOf, amount).map(
      roundAmount,
    ),
  };
}

export async function revenueKpi(period: Period): Promise<KpiPayload> {
  return summedKpi(
    await billedInvoices(),
    period,
    (invoice) => invoice.issuedAt,
    (invoice) => invoice.amountExcl,
  );
}

export async function signedQuotesKpi(period: Period): Promise<KpiPayload> {
  return summedKpi(
    await acceptedQuotes(),
    period,
    (quote) => quote.signedAt,
    (quote) => quote.subtotal,
  );
}

/** Accepted quotes over decided quotes issued in the range, in percent. */
function conversionIn(quotes: readonly Quote[], range: TimeRange): number {
  const decided = quotes.filter(
    (quote) =>
      DECIDED_STATUSES.has(quote.status) && within(quote.issuedAt, range),
  );
  if (decided.length === 0) return 0;
  const accepted = decided.filter((quote) => quote.status === "accepted");
  return Math.round((accepted.length / decided.length) * 1000) / 10;
}

export async function conversionKpi(period: Period): Promise<KpiPayload> {
  const quotes = await GetModel(QuoteModel).getAll();
  const value = conversionIn(quotes, period.range);
  const previous = period.compare
    ? conversionIn(quotes, period.compare)
    : undefined;
  return {
    value,
    previousValue: previous,
    delta: deltaPercent(value, previous),
    sparkline: slices(period.range, 6).map((range) =>
      conversionIn(quotes, range),
    ),
  };
}

/**
 * Running total in cents, rounded to the euro once per point: its last point
 * is the revenue KPI to the euro (see sumByRange).
 */
function cumulative(values: readonly number[]): number[] {
  let cents = 0;
  return values.map((value) => {
    cents += Math.round(value * 100);
    return roundAmount(cents / 100);
  });
}

/**
 * Revenue invoiced as a running total over the period, the comparison period
 * drawn on the same points so the two curves read against each other. The
 * comparison covers the whole comparison range, so its total is the one
 * "Revenue invoiced" compares with, even when the two ranges differ in length.
 */
export async function revenueTrend(period: Period): Promise<ChartCardPayload> {
  const invoices = await billedInvoices();
  const buckets = chartBuckets(period.range);
  const labels = buckets.map(bucketLabel);
  const dateOf = (invoice: Invoice) => invoice.issuedAt;
  const amount = (invoice: Invoice) => invoice.amountExcl;
  const current = cumulative(sumByRange(invoices, buckets, dateOf, amount));
  const value = current[current.length - 1] ?? 0;
  const payload: ChartCardPayload = {
    value,
    delta: null,
    series: [
      {
        name: "$helio.dashboard.revenueTrend.current",
        data: current.map((y, index) => ({ x: labels[index] ?? "", y })),
      },
    ],
  };
  if (!period.compare) return payload;
  const previous = cumulative(
    sumByRange(
      invoices,
      shiftBuckets(buckets, period.range, period.compare),
      dateOf,
      amount,
    ),
  );
  const previousValue = previous[previous.length - 1] ?? 0;
  return {
    ...payload,
    previousValue,
    delta: deltaPercent(value, previousValue),
    comparisonSeries: [
      {
        name: "$helio.dashboard.revenueTrend.previous",
        data: previous.map((y, index) => ({ x: labels[index] ?? "", y })),
      },
    ],
  };
}

const CATEGORY_PARENT = new Map(
  PRODUCT_CATEGORY_ROSTER.map((entry) => [entry.id, entry.parent ?? entry.id]),
);
const PRODUCT_FAMILY = new Map(
  PRODUCT_ROSTER.map((product) => [
    product.id,
    CATEGORY_PARENT.get(product.category) ?? product.category,
  ]),
);

/**
 * Slice labels are printed as sent (see ./locale): the family names are
 * written in the reader's language here.
 */
function familyName(familyId: string, language: ReaderLanguage): string {
  const entry = PRODUCT_CATEGORY_ROSTER.find((row) => row.id === familyId);
  return entry ? entry.name[language] : familyId;
}

function mixOf(
  quotes: readonly Quote[],
  range: TimeRange,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const quote of quotes) {
    if (!within(quote.signedAt, range)) continue;
    for (const line of quote.lines ?? []) {
      const family = PRODUCT_FAMILY.get(line.product) ?? "cat-services";
      totals.set(family, (totals.get(family) ?? 0) + line.qty * line.unitPrice);
    }
  }
  return totals;
}

function sumOf(totals: Map<string, number>): number {
  return [...totals.values()].reduce((sum, value) => sum + value, 0);
}

/** What the signed quotes of the period sold, by product family. */
export async function productMix(
  period: Period,
  language: ReaderLanguage,
): Promise<ChartCardPayload> {
  const quotes = await acceptedQuotes();
  const totals = mixOf(quotes, period.range);
  const value = roundAmount(sumOf(totals));
  const previous = period.compare
    ? roundAmount(sumOf(mixOf(quotes, period.compare)))
    : undefined;
  const data = [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([family, total]) => ({
      x: familyName(family, language),
      y: roundAmount(total),
    }));
  return {
    value,
    previousValue: previous,
    delta: deltaPercent(value, previous),
    series: data.length
      ? [{ name: "$helio.dashboard.productMix.series", data }]
      : [],
  };
}
