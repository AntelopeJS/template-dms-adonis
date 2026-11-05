import { HTTPResult } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { mailInvoiceReminder } from "../platform/mailing/send";
import { CustomerModel } from "../crm/database";
import { type ActivityEntry, logActivity } from "../dashboard/log";
import { teamIdsByRole } from "../shared/roster";
import { DAY_MS } from "../shared/seed";
import { type Invoice, InvoiceModel, type PaymentMethod } from "./database";
import { isPastDue } from "./due";
import { helioNow } from "../shared/clock";

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;

/**
 * Payments and reminders are the accounts office's: its first member signs the
 * activity feed entries.
 */
const ACCOUNTS = teamIdsByRole("office")[0] ?? "";

/**
 * Logs invoice events to the dashboard's activity feed, each named
 * "F-2026-0315 · customer".
 */
export async function logInvoiceEvents(
  type: "invoice_paid" | "invoice_overdue",
  invoices: readonly Invoice[],
): Promise<void> {
  const customers = GetModel(CustomerModel);
  const entries = await Promise.all(
    invoices.map(async (invoice): Promise<ActivityEntry> => {
      const customer = await customers.get(invoice.customer);
      return {
        type,
        actor: ACCOUNTS,
        subject: [invoice.number, customer?.name].filter(Boolean).join(" · "),
        record: { kind: "invoice", id: invoice._id },
      };
    }),
  );
  await logActivity(...entries);
}

/** Logs an invoice marked paid from its form (read once written). */
export async function logInvoicePaid(id: string): Promise<void> {
  const invoice = await GetModel(InvoiceModel).get(id);
  if (invoice?.status === "paid")
    await logInvoiceEvents("invoice_paid", [invoice]);
}

/** Statuses an invoice can be paid from: issued, not settled. */
export const PAYABLE_STATUSES = ["sent", "overdue"] as const;
const PAYMENT_METHOD_VALUES: readonly string[] = [
  "transfer",
  "direct_debit",
  "card",
];

/** The values of the "Mark as paid" confirmation. */
export interface PaymentInput {
  paymentMethod?: string;
  paidAt?: string;
}

const isPayable = (invoice: Invoice): boolean =>
  PAYABLE_STATUSES.some((status) => status === invoice.status);

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_VALUES.includes(value);
}

/**
 * A payment is dated today when the dialog leaves the date empty. An invalid
 * date, or one more than a day ahead, is refused with a 400: money not
 * received yet is not a payment.
 */
function paymentDate(raw: string | undefined): Date {
  if (!raw) return new Date(helioNow());
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.getTime() > helioNow() + DAY_MS) {
    throw new HTTPResult(HTTP_BAD_REQUEST, {
      message: "$helio.finance.invoices.markPaid.futureDate",
      field: "paidAt",
    });
  }
  return date;
}

function paymentMethod(raw: string | undefined): PaymentMethod {
  if (raw && isPaymentMethod(raw)) return raw;
  throw new HTTPResult(HTTP_BAD_REQUEST, {
    message: "$helio.finance.invoices.markPaid.methodRequired",
    field: "paymentMethod",
  });
}

async function payableInvoices(ids: string[]): Promise<Invoice[]> {
  const model = GetModel(InvoiceModel);
  const invoices = await Promise.all(
    ids.filter(Boolean).map((id) => model.get(id)),
  );
  return invoices.filter(
    (invoice): invoice is Invoice => !!invoice && isPayable(invoice),
  );
}

/**
 * Records the payment of the invoices still to be paid among `ids`: paid on
 * that date with that method, nothing left due. Answers how many were paid;
 * refuses when none of them could be.
 */
export async function markInvoicesPaid(
  ids: string[],
  input: PaymentInput,
): Promise<number> {
  const method = paymentMethod(input.paymentMethod);
  const paidAt = paymentDate(input.paidAt);
  const invoices = await payableInvoices(ids);
  if (invoices.length === 0) {
    throw new HTTPResult(HTTP_CONFLICT, {
      message: "$helio.finance.invoices.markPaid.nothing",
    });
  }
  const model = GetModel(InvoiceModel);
  await Promise.all(
    invoices.map((invoice) =>
      model.update(invoice._id, {
        status: "paid",
        paidAt,
        amountDue: 0,
        paymentMethod: method,
      }),
    ),
  );
  await logInvoiceEvents("invoice_paid", invoices);
  return invoices.length;
}

/**
 * Stamps a reminder on the overdue invoices among `ids` and e-mails it to
 * their customers. Answers how many were reminded. The e-mails go out in the
 * background: Helio's `mailInvoiceReminder` (`platform/mailing/send.ts`)
 * logs a failed one as a warning, and the reminder stays recorded.
 */
export async function remindInvoices(ids: string[]): Promise<number> {
  const model = GetModel(InvoiceModel);
  const invoices = (
    await Promise.all(ids.filter(Boolean).map((id) => model.get(id)))
  ).filter((invoice): invoice is Invoice => invoice?.status === "overdue");
  if (invoices.length === 0) {
    throw new HTTPResult(HTTP_CONFLICT, {
      message: "$helio.finance.invoices.remind.nothing",
    });
  }
  const remindedAt = new Date(helioNow());
  await Promise.all(
    invoices.map((invoice) =>
      model.update(invoice._id, {
        remindedAt,
        reminderCount: (invoice.reminderCount ?? 0) + 1,
      }),
    ),
  );
  for (const invoice of invoices) {
    void mailInvoiceReminder(invoice, (invoice.reminderCount ?? 0) + 1);
  }
  return invoices.length;
}

/**
 * Cancels the issued, unpaid invoices among `ids`: in Belgian practice an
 * issued invoice is never deleted, a credit note cancels it. Nothing is left
 * to pay; the number stays taken. Answers how many were cancelled.
 */
export async function cancelInvoices(ids: string[]): Promise<number> {
  const invoices = await payableInvoices(ids);
  if (invoices.length === 0) {
    throw new HTTPResult(HTTP_CONFLICT, {
      message: "$helio.finance.invoices.cancel.nothing",
    });
  }
  const model = GetModel(InvoiceModel);
  await Promise.all(
    invoices.map((invoice) =>
      model.update(invoice._id, { status: "cancelled", amountDue: 0 }),
    ),
  );
  return invoices.length;
}

const OVERDUE_SWEEP_EVERY_MS = 5 * 60 * 1000;
let lastSweep = 0;

/**
 * Moves the sent invoices whose due day is over to "overdue" (an invoice due
 * today is late from tomorrow, see ./due), and back to "sent" one marked late
 * on its due day. The seed is written once, relative to its boot: without
 * this, an invoice due tomorrow would stay "sent" forever. Read paths call
 * it, at most every few minutes.
 */
export async function sweepOverdueInvoices(): Promise<void> {
  if (Date.now() - lastSweep < OVERDUE_SWEEP_EVERY_MS) return;
  lastSweep = Date.now();
  const model = GetModel(InvoiceModel);
  const [sent, overdue] = await Promise.all([
    model.getBy("status", "sent"),
    model.getBy("status", "overdue"),
  ]);
  const late = sent.filter((invoice) => isPastDue(invoice.dueAt));
  const early = overdue.filter((invoice) => !isPastDue(invoice.dueAt));
  await Promise.all([
    ...late.map((invoice) => model.update(invoice._id, { status: "overdue" })),
    ...early.map((invoice) => model.update(invoice._id, { status: "sent" })),
  ]);
  await logInvoiceEvents("invoice_overdue", late);
}
