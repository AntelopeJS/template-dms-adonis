import { HTTPResult } from "@antelopejs/interface-api";
import type { DataControllerCallback } from "@antelopejs/interface-data-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { defaultVatRate } from "../sales/vat-rate";
import { currentSettings } from "../settings/current";
import { DEFAULT_INVOICE_PATTERN } from "../settings/defaults";
import { nextNumber } from "../settings/number-pattern";
import { isBlank, textOf, withBodyDefaults } from "../shared/body-defaults";
import { isText, type JsonValue } from "../shared/json";
import { DAY_MS } from "../shared/seed";
import { InvoiceModel } from "./database";
import { helioNow } from "../shared/clock";

const HTTP_BAD_REQUEST = 400;

/**
 * The next free number the invoice pattern of the Settings page gives on
 * `date` (`F-{YYYY}-{SEQ:4}` by default: F-2026-0001, F-2026-0002, ...).
 */
export async function nextInvoiceNumber(
  date = new Date(helioNow()),
): Promise<string> {
  const [settings, invoices] = await Promise.all([
    currentSettings(),
    GetModel(InvoiceModel).getAll(),
  ]);
  return nextNumber(
    settings.invoiceNumberPattern,
    date,
    invoices.map((invoice) => invoice.number),
    DEFAULT_INVOICE_PATTERN,
  );
}

function issueDate(value: JsonValue | undefined): Date {
  const date = isText(value) ? new Date(value) : new Date(helioNow());
  return Number.isNaN(date.getTime()) ? new Date(helioNow()) : date;
}

/**
 * The `new` route with what the body leaves empty filled in: the number,
 * the due date (the issue date plus the payment terms) and the VAT rate.
 * Two invoices created in the same instant could draw the same number: the
 * second is then refused by the unique-number check, a real ledger would
 * use an atomic counter.
 */
export function withInvoiceDefaults(
  route: DataControllerCallback,
): DataControllerCallback {
  return withBodyDefaults(route, async (body) => {
    const settings = await currentSettings();
    const issuedAt = issueDate(body.issuedAt);
    if (isBlank(body.number)) body.number = await nextInvoiceNumber(issuedAt);
    if (isBlank(body.dueAt)) {
      body.dueAt = new Date(
        issuedAt.getTime() + settings.paymentTermsDays * DAY_MS,
      ).toISOString();
    }
    if (isBlank(body.vatRate))
      body.vatRate = await defaultVatRate(textOf(body.customer), settings);
  });
}

/**
 * Refuses a number another invoice already has (`id`: the invoice being
 * edited, absent on a creation): two invoices with one number would share a
 * structured reference too.
 */
export async function assertUniqueNumber(
  number: string | null | undefined,
  id?: string,
): Promise<void> {
  if (!isText(number) || number.trim() === "") return;
  const taken = await GetModel(InvoiceModel).getBy("number", number);
  if (taken.some((invoice) => invoice._id !== id)) {
    throw new HTTPResult(HTTP_BAD_REQUEST, {
      message: "$helio.finance.invoices.errors.numberTaken",
      field: "number",
    });
  }
}
