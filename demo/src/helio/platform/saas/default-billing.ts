import { GetModel } from "@antelopejs/interface-database-decorators";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { TenantModel } from "@antelopejs/interface-dms/db";
import {
  CreditNoteModel,
  type Invoice,
  InvoiceModel,
  RefundModel,
  TenantBillingInfoModel,
} from "@antelopejs/interface-dms-saas/db";
import { PLAN_IDS } from "./plans";
import {
  addDays,
  addMonths,
  insertMissing,
  type RowOf,
  type SeedRow,
} from "./rows";
import { type BillingPeriod, billingPeriods } from "./schedule";
import { invoiceIdOf, writeInvoices } from "./write-invoices";
import type { SeedWorkspace } from "./workspaces";
import { helioInstalledAt } from "../../shared/clock";

const BE_VAT = 21;
const PERCENT = 100;
/** The latest invoice is the one issued on the day the demo was installed. */
const HISTORY_MONTHS = 11;
/** The invoice the goodwill credit was granted on, counted from the first. */
const CREDITED_PERIOD = 8;
const CREDIT_DELAY_DAYS = 6;
/** A third of a month's Business fee, in cents excluding VAT. */
const CREDIT_SUBTOTAL = 7300;
const CREDIT_NUMBER = "HELIO-CN-0001";
const CREDIT_NOTE_ID = `${DEFAULT_TENANT_ID}-cn-0001`;
const REFUND_ID = "re_demo_helio_0001";
const CREDIT_REASON = "product_unsatisfactory";
const CREDIT_MEMO =
  "Goodwill credit: fleet monitoring unavailable for 10 days (incident #2291)";

/** Helio SRL as its invoices know it, the identity of the company settings. */
const HELIO_BILLING: SeedWorkspace = {
  id: DEFAULT_TENANT_ID,
  name: "Helio SRL",
  code: "HELIO",
  ageMonths: HISTORY_MONTHS,
  ageDays: 0,
  planId: PLAN_IDS.business,
  status: "active",
  taxRate: BE_VAT,
  billing: {
    customerType: "business",
    companyName: "Helio SRL",
    vatNumber: "BE0742318065",
    billingEmail: "compta@helio.example",
    address: {
      line1: "Rue de l'Énergie 12",
      line2: null,
      postalCode: "4040",
      city: "Herstal",
      state: null,
      country: "BE",
    },
  },
};

/** When the history begins: the install date, a year of periods back. */
function historyStart(installedAt: Date): Date {
  return addMonths(installedAt, -HISTORY_MONTHS);
}

/** Writes the invoicing identity unless one is stored: the owner's own is never overwritten. */
async function writeBillingInfo(): Promise<void> {
  await insertMissing(
    TenantBillingInfoModel,
    [
      {
        ...HELIO_BILLING.billing,
        _id: DEFAULT_TENANT_ID,
        vatVerificationStatus: "verified",
      },
    ],
    DEFAULT_TENANT_ID,
  );
}

interface CreditAmounts {
  subtotal: number;
  tax: number;
  total: number;
}

function creditAmounts(): CreditAmounts {
  const tax = Math.round((CREDIT_SUBTOTAL * HELIO_BILLING.taxRate) / PERCENT);
  return { subtotal: CREDIT_SUBTOTAL, tax, total: CREDIT_SUBTOTAL + tax };
}

/** The credit note itself. Its amount includes the VAT it gives back, as Stripe's does. */
function toCreditNoteRow(
  parentId: string,
  issuedAt: Date,
): SeedRow<RowOf<typeof CreditNoteModel>> {
  return {
    _id: CREDIT_NOTE_ID,
    invoiceId: parentId,
    stripeCreditNoteId: CREDIT_NOTE_ID,
    number: CREDIT_NUMBER,
    amount: creditAmounts().total,
    currency: "eur",
    reason: CREDIT_REASON,
    memo: CREDIT_MEMO,
    type: "refund",
    refundId: REFUND_ID,
    hostedUrl: null,
    pdfUrl: null,
    status: "issued",
    issuedAt,
    voidedAt: null,
    metadata: {},
    createdAt: issuedAt,
    updatedAt: issuedAt,
  };
}

/** The credit note as the billing documents list shows it, beside invoices. */
function toCreditNoteDocumentRow(
  parent: Invoice,
  period: BillingPeriod,
  issuedAt: Date,
): SeedRow<RowOf<typeof InvoiceModel>> {
  const { subtotal, tax, total } = creditAmounts();
  return {
    _id: CREDIT_NOTE_ID,
    documentType: "credit_note",
    stripeInvoiceId: parent.stripeInvoiceId,
    stripeCreditNoteId: CREDIT_NOTE_ID,
    number: CREDIT_NUMBER,
    parentInvoiceNumber: parent.number,
    amount: -total,
    subtotal: -subtotal,
    tax: -tax,
    total: -total,
    amountPaid: 0,
    attemptCount: 0,
    nextPaymentAttemptAt: null,
    dueAt: null,
    autoFinalizesAt: null,
    latestRevisionStripeId: null,
    currency: parent.currency,
    periodStart: period.start,
    periodEnd: period.end,
    lines: [
      {
        description: CREDIT_MEMO,
        quantity: 1,
        amount: -subtotal,
        currency: parent.currency,
        periodStart: period.start,
        periodEnd: period.end,
      },
    ],
    status: "issued",
    creditNoteReason: CREDIT_REASON,
    creditNoteType: "refund",
    memo: CREDIT_MEMO,
    hostedInvoiceUrl: null,
    invoicePdfUrl: null,
    metadata: parent.metadata,
    paidAt: null,
    voidedAt: null,
    issuedAt,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  };
}

function toRefundRow(issuedAt: Date): SeedRow<RowOf<typeof RefundModel>> {
  return {
    _id: REFUND_ID,
    creditNoteId: CREDIT_NOTE_ID,
    stripeRefundId: REFUND_ID,
    amount: creditAmounts().total,
    currency: "eur",
    status: "succeeded",
    failureReason: null,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  };
}

async function writeCreditNote(anchor: Date, now: Date): Promise<void> {
  const period = billingPeriods(HELIO_BILLING, anchor, now)[CREDITED_PERIOD];
  if (!period) return;
  const invoices = GetModel(InvoiceModel, DEFAULT_TENANT_ID);
  const parent = await invoices.get(invoiceIdOf(HELIO_BILLING, period));
  if (!parent) return;
  const issuedAt = addDays(period.start, CREDIT_DELAY_DAYS);
  await insertMissing(
    CreditNoteModel,
    [toCreditNoteRow(parent._id, issuedAt)],
    DEFAULT_TENANT_ID,
  );
  await insertMissing(
    InvoiceModel,
    [toCreditNoteDocumentRow(parent, period, issuedAt)],
    DEFAULT_TENANT_ID,
  );
  await insertMissing(RefundModel, [toRefundRow(issuedAt)], DEFAULT_TENANT_ID);
}

/**
 * Seeds the billing page of Helio SRL's own workspace (the default tenant): its
 * invoicing identity, a year of invoices and a partial refund, so a demo shows
 * billing without switching workspace. The workspace stays on the internal
 * Helio HQ plan (priced 0, see `default-workspace.ts`); its history reads as
 * the Business tier Helio SRL paid before, which is why the invoices name
 * Business and the HQ subscription is left untouched.
 *
 * Invoices are written like the installer workspaces' (`write-invoices.ts`),
 * and the credit note the way the dms-saas playground mirrors one: the credit
 * note row, its line in the billing documents list, and the card refund behind
 * it. Idempotent: every row has a fixed id and is only written while missing;
 * a new invoice appears on each monthly anniversary of the install, as for the
 * installer workspaces.
 */
export async function writeDefaultBilling(now: Date): Promise<void> {
  const tenant = await GetModel(TenantModel).get(DEFAULT_TENANT_ID);
  if (!tenant) return;
  const anchor = historyStart(helioInstalledAt(tenant.createdAt));
  await writeBillingInfo();
  await writeInvoices(HELIO_BILLING, anchor, now);
  await writeCreditNote(anchor, now);
}
