import { buildSites, type SiteSeed } from "../monitoring/fixtures";
import { customerFacts, isBusiness } from "../projects/crm-facts";
import { nextWorkday, previousWorkday } from "../projects/calendar";
import { type ProjectPlan, projectPlans } from "../projects/plan";
import { quoteTotals, VAT_BUSINESS, VAT_RESIDENTIAL } from "../sales/lines";
import type { QuoteLine } from "../sales/database";
import { COUNTS, invoiceId, PRODUCT_ROSTER } from "../shared/roster";
import { cents, createRng, DAY_MS, type Rng } from "../shared/seed";
import type { Invoice, PaymentMethod } from "./database";
import { isPastDue } from "./due";
import { helioNow } from "../shared/clock";

export type InvoiceSeed = Pick<
  Invoice,
  | "_id"
  | "number"
  | "customer"
  | "project"
  | "quote"
  | "status"
  | "issuedAt"
  | "dueAt"
  | "paidAt"
  | "amountExcl"
  | "vatRate"
  | "vatAmount"
  | "total"
  | "amountDue"
  | "paymentMethod"
  | "isArchived"
>;

const YEAR_DAYS = 365;
const DEPOSIT_SHARE = 0.3;
/** Paid invoices older than this are archived. */
const ARCHIVE_AFTER_DAYS = 300;

interface InvoiceDraft {
  customer: string;
  business: boolean;
  project?: string;
  quote?: string;
  amountExcl: number;
  vatRate: number;
  issuedAt: Date;
  /** A balance waiting for the electrical inspection stays a draft. */
  draft?: boolean;
}

function daysAgo(date: Date): number {
  return (helioNow() - date.getTime()) / DAY_MS;
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The deposit invoice of a project, a 30% share issued shortly after its quote
 * is signed, and its balance invoice once installed (still a draft while the
 * electrical inspection is pending). Invoices go out on working days.
 */
function projectDrafts(plan: ProjectPlan): InvoiceDraft[] {
  const business = isBusiness(plan.customer);
  const { subtotal } = quoteTotals(plan.lines, plan.vatRate);
  const base = {
    customer: plan.customer._id,
    business,
    project: plan.projectId,
    quote: plan.quoteId,
    vatRate: plan.vatRate,
  };
  const drafts: InvoiceDraft[] = [];
  const depositAt = nextWorkday(plusDays(plan.signedAt, 2));
  if (daysAgo(depositAt) > 0 && daysAgo(depositAt) < YEAR_DAYS) {
    drafts.push({
      ...base,
      amountExcl: cents(subtotal * DEPOSIT_SHARE),
      issuedAt: depositAt,
    });
  }
  if (plan.status === "done" || plan.status === "inspection") {
    const balanceAt = previousWorkday(
      new Date(
        Math.min(
          nextWorkday(plusDays(plan.end, 3)).getTime(),
          helioNow() - DAY_MS,
        ),
      ),
    );
    drafts.push({
      ...base,
      amountExcl: cents(subtotal - cents(subtotal * DEPOSIT_SHARE)),
      issuedAt: balanceAt,
      draft: plan.status === "inspection",
    });
  }
  return drafts;
}

function price(id: string): number {
  return PRODUCT_ROSTER.find((entry) => entry.id === id)?.price ?? 0;
}

/**
 * A contract renewal, a service call or a cleaning on a monitored site,
 * issued after the site was commissioned. A monitoring subscription is a
 * service, never renovation work, so it carries the 21% rate even for a
 * residential customer.
 */
function serviceDraft(rng: Rng, site: SiteSeed): InvoiceDraft {
  const business = isBusiness(customerFacts(site.customer));
  const kind = rng.weighted([
    ["maintenance", 3],
    ["monitoring", 3],
    ["call", 3],
    ["cleaning", 1],
  ] as const);
  const lines: QuoteLine[] = {
    maintenance: [
      { product: "prod-22", label: "", qty: 1, unitPrice: price("prod-22") },
    ],
    monitoring: [
      { product: "prod-23", label: "", qty: 1, unitPrice: price("prod-23") },
    ],
    call: [
      {
        product: "prod-21",
        label: "",
        qty: rng.int(1, 4),
        unitPrice: price("prod-21"),
      },
    ],
    cleaning: [
      {
        product: "prod-24",
        label: "",
        qty: Math.round(site.capacityKwp * 2.4),
        unitPrice: price("prod-24"),
      },
    ],
  }[kind];
  const vatRate =
    business || kind === "monitoring" ? VAT_BUSINESS : VAT_RESIDENTIAL;
  const since = Math.min(
    YEAR_DAYS - 1,
    Math.floor(daysAgo(site.commissionedAt)) - 1,
  );
  return {
    customer: site.customer,
    business,
    amountExcl: quoteTotals(lines, vatRate).subtotal,
    vatRate,
    issuedAt: previousWorkday(
      plusDays(new Date(helioNow()), -rng.int(1, Math.max(2, since))),
    ),
  };
}

function paymentMethod(rng: Rng, business: boolean): PaymentMethod {
  return business
    ? rng.weighted<PaymentMethod>([
        ["transfer", 8],
        ["direct_debit", 2],
      ])
    : rng.weighted<PaymentMethod>([
        ["transfer", 6],
        ["direct_debit", 2],
        ["card", 2],
      ]);
}

/**
 * When a payment is booked: on a working day, during office hours, and never
 * later than a few hours ago. Undefined when that falls before the invoice
 * was issued, since an invoice issued this morning is not paid yet.
 */
function bookedPayment(
  rng: Rng,
  wanted: number,
  issuedAt: Date,
): Date | undefined {
  const latest = helioNow() - DAY_MS / 4;
  const day = previousWorkday(new Date(Math.min(wanted, latest)));
  day.setHours(rng.int(9, 16), rng.int(0, 59), 0, 0);
  const booked =
    day.getTime() > latest
      ? previousWorkday(new Date(day.getTime() - DAY_MS))
      : day;
  return booked > issuedAt ? booked : undefined;
}

/**
 * Paid, waiting or overdue, from the due date: a quarter of the invoices that
 * fell due in the last two months are still unpaid. An invoice due today is
 * not late yet, overdue starts the day after (see `./due`).
 */
function settle(
  rng: Rng,
  draft: InvoiceDraft,
  dueAt: Date,
): Pick<Invoice, "status" | "paidAt"> {
  if (draft.draft) return { status: "draft" };
  const issued = draft.issuedAt.getTime();
  if (!isPastDue(dueAt)) {
    if (!rng.chance(0.35)) return { status: "sent" };
    const paidAt = bookedPayment(
      rng,
      issued + rng.int(1, 10) * DAY_MS,
      draft.issuedAt,
    );
    return paidAt ? { status: "paid", paidAt } : { status: "sent" };
  }
  if (daysAgo(dueAt) < 60 && rng.chance(0.25)) return { status: "overdue" };
  const termDays = Math.round((dueAt.getTime() - issued) / DAY_MS);
  const paidAt = bookedPayment(
    rng,
    issued + rng.int(3, termDays + 5) * DAY_MS,
    draft.issuedAt,
  );
  return paidAt ? { status: "paid", paidAt } : { status: "overdue" };
}

function toSeed(rng: Rng, draft: InvoiceDraft, index: number): InvoiceSeed {
  const dueAt = plusDays(draft.issuedAt, draft.business ? 30 : 15);
  const { status, paidAt } = settle(rng, draft, dueAt);
  const vatAmount = cents(draft.amountExcl * draft.vatRate);
  const total = cents(draft.amountExcl + vatAmount);
  return {
    _id: invoiceId(index),
    number: "",
    customer: draft.customer,
    project: draft.project,
    quote: draft.quote,
    status,
    issuedAt: draft.issuedAt,
    dueAt,
    paidAt,
    amountExcl: draft.amountExcl,
    vatRate: draft.vatRate,
    vatAmount,
    total,
    amountDue: status === "paid" ? 0 : total,
    paymentMethod: paymentMethod(rng, draft.business),
    isArchived:
      status === "paid" && daysAgo(draft.issuedAt) > ARCHIVE_AFTER_DAYS,
  };
}

/**
 * Cancels three old paid service invoices, as if a credit note had replaced
 * them, then numbers every invoice by issue date within its year: F-2026-0001,
 * F-2026-0002, ...
 */
function finish(seeds: InvoiceSeed[]): void {
  seeds
    .filter(
      (seed) =>
        !seed.project && seed.status === "paid" && daysAgo(seed.issuedAt) > 60,
    )
    .slice(0, 3)
    .forEach((seed) => {
      seed.status = "cancelled";
      seed.paidAt = undefined;
      seed.amountDue = 0;
    });
  const counters = new Map<number, number>();
  for (const seed of [...seeds].sort(
    (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
  )) {
    const year = seed.issuedAt.getFullYear();
    const next = (counters.get(year) ?? 0) + 1;
    counters.set(year, next);
    seed.number = `F-${year}-${String(next).padStart(4, "0")}`;
  }
}

let invoices: InvoiceSeed[] | undefined;

/**
 * The 200 invoices, `inv-001` ... `inv-200`: a year of billing. Each project
 * bills its deposit and balance; yearly maintenance and monitoring contracts,
 * service calls and cleanings fill the rest. Most are paid, a few overdue, and
 * the oldest paid ones archived.
 */
export function buildInvoices(): InvoiceSeed[] {
  if (!invoices) {
    const rng = createRng(0x9e110007);
    const sites = buildSites();
    const drafts = projectPlans()
      .flatMap(projectDrafts)
      .slice(0, COUNTS.invoices);
    while (drafts.length < COUNTS.invoices)
      drafts.push(serviceDraft(rng, rng.pick(sites)));
    invoices = drafts.map((draft, at) => toSeed(rng, draft, at + 1));
    finish(invoices);
  }
  return invoices;
}
