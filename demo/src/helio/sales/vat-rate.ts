import { HTTPResult } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { CustomerModel } from "../crm/database";
import type { InvoicingSettings } from "../settings/types";
import { isNumber, isText } from "../shared/json";
import { VAT_BUSINESS } from "./lines";

/**
 * Refuses a business quote at a rate below the standard one, whichever client
 * sent it. The reduced Belgian rate (6 %) only covers renovation works in a
 * private home over ten years old, so a business is invoiced at the standard
 * 21 %; a household may be quoted at either rate (a home under ten years pays
 * 21 % too). Throws a 400 on the `vatRate` field.
 */
export async function assertVatRate(
  customerId: string | null | undefined,
  vatRate: number | null | undefined,
): Promise<void> {
  if (!isText(customerId) || !isNumber(vatRate)) return;
  if (vatRate >= VAT_BUSINESS) return;
  const customer = await GetModel(CustomerModel).get(customerId);
  if (customer?.kind !== "business") return;
  throw new HTTPResult(400, {
    message: "$helio.sales.quotes.errors.businessVat",
    field: "vatRate",
  });
}

/**
 * The rate a new quote or invoice takes when none is typed in: the default
 * rate of the Settings page, never below the standard rate for a business.
 */
export async function defaultVatRate(
  customerId: string | undefined,
  settings: Pick<InvoicingSettings, "defaultVatRate">,
): Promise<number> {
  const rate = settings.defaultVatRate;
  if (!isText(customerId) || rate >= VAT_BUSINESS) return rate;
  const customer = await GetModel(CustomerModel).get(customerId);
  return customer?.kind === "business" ? VAT_BUSINESS : rate;
}
