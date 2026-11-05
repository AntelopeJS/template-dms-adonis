import { GetModel } from "@antelopejs/interface-database-decorators";
import {
  type InvoiceLine,
  InvoiceModel,
} from "@antelopejs/interface-dms-saas/db";
import { findPlan } from "./plans";
import { addDays, insertMissing, type RowOf, type SeedRow } from "./rows";
import { type BillingPeriod, billingPeriods } from "./schedule";
import type { SeedWorkspace } from "./workspaces";
import { helioNow } from "../../shared/clock";

const CURRENCY = "eur";
const MINOR_PER_MAJOR = 100;
const PERCENT = 100;
const NUMBER_DIGITS = 4;
/** Stripe's smart retries: the card is tried again in a couple of days. */
const NEXT_RETRY_DAYS = 2;
const FAILED_ATTEMPTS = 3;
const PAID_STATUS = "paid";
const OPEN_STATUS = "open";

function sequence(period: BillingPeriod): string {
  return String(period.index + 1).padStart(NUMBER_DIGITS, "0");
}

/** The invoice id of a period, stable across boots. */
export function invoiceIdOf(
  workspace: SeedWorkspace,
  period: BillingPeriod,
): string {
  return `${workspace.id}-in-${sequence(period)}`;
}

function lineDescription(workspace: SeedWorkspace): string {
  const plan = findPlan(workspace.planId);
  return `1 × Helio ${plan.name.en} (at €${plan.price.toFixed(2)} / ${plan.interval})`;
}

function toLines(
  workspace: SeedWorkspace,
  period: BillingPeriod,
  subtotal: number,
): InvoiceLine[] {
  return [
    {
      description: lineDescription(workspace),
      quantity: 1,
      amount: subtotal,
      currency: CURRENCY,
      periodStart: period.start,
      periodEnd: period.end,
    },
  ];
}

function toInvoiceRow(
  workspace: SeedWorkspace,
  period: BillingPeriod,
  isOpen: boolean,
  now: Date,
): SeedRow<RowOf<typeof InvoiceModel>> {
  const plan = findPlan(workspace.planId);
  const subtotal = Math.round(plan.price * MINOR_PER_MAJOR);
  const tax = Math.round((subtotal * workspace.taxRate) / PERCENT);
  const total = subtotal + tax;
  const id = invoiceIdOf(workspace, period);
  return {
    _id: id,
    documentType: "invoice",
    stripeInvoiceId: `in_demo_${workspace.code.toLowerCase()}_${sequence(period)}`,
    stripeCreditNoteId: null,
    number: `${workspace.code}-${sequence(period)}`,
    parentInvoiceNumber: null,
    amount: total,
    subtotal,
    tax,
    total,
    amountPaid: isOpen ? 0 : total,
    attemptCount: isOpen ? FAILED_ATTEMPTS : 1,
    nextPaymentAttemptAt: isOpen ? addDays(now, NEXT_RETRY_DAYS) : null,
    dueAt: null,
    autoFinalizesAt: null,
    latestRevisionStripeId: null,
    currency: CURRENCY,
    periodStart: period.start,
    periodEnd: period.end,
    lines: toLines(workspace, period, subtotal),
    status: isOpen ? OPEN_STATUS : PAID_STATUS,
    creditNoteReason: null,
    creditNoteType: null,
    memo: null,
    hostedInvoiceUrl: null,
    invoicePdfUrl: null,
    metadata: { planId: plan.id, planName: plan.name.en },
    paidAt: isOpen ? null : period.start,
    voidedAt: null,
    issuedAt: period.start,
    createdAt: period.start,
    updatedAt: period.start,
  };
}

/**
 * Settles the invoices left open by an earlier boot: in dunning, only the
 * latest period's invoice stays unpaid.
 */
async function settleOlderOpenInvoices(
  workspace: SeedWorkspace,
  latestId: string,
): Promise<void> {
  const model = GetModel(InvoiceModel, workspace.id);
  const open = await model.findOpenIssuedBefore(new Date(helioNow()));
  for (const invoice of open) {
    if (invoice._id === latestId || !invoice._id.startsWith(workspace.id))
      continue;
    await model.update(invoice._id, {
      status: PAID_STATUS,
      amountPaid: invoice.total,
      nextPaymentAttemptAt: null,
      paidAt: addDays(new Date(invoice.issuedAt), FAILED_ATTEMPTS),
    });
  }
}

/**
 * Writes the invoices of the periods begun since the last boot, as the Stripe
 * webhooks would have mirrored them: one invoice per billing period, paid by
 * card on the day it was issued. A workspace in dunning has its latest invoice
 * still open, which is what puts it in the operator's "needs attention" queue.
 */
export async function writeInvoices(
  workspace: SeedWorkspace,
  anchor: Date,
  now: Date,
): Promise<void> {
  const periods = billingPeriods(workspace, anchor, now);
  const latest = periods[periods.length - 1];
  if (!latest) return;
  const isDunning = workspace.status === "past_due";
  await insertMissing(
    InvoiceModel,
    periods.map((period) =>
      toInvoiceRow(workspace, period, isDunning && period === latest, now),
    ),
    workspace.id,
  );
  if (isDunning)
    await settleOlderOpenInvoices(workspace, invoiceIdOf(workspace, latest));
}
