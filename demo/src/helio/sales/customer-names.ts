import { GetModel } from "@antelopejs/interface-database-decorators";
import type { AfterWrite } from "@antelopejs/interface-dms/base/types/guards";
import { CustomerModel } from "../crm/database";
import { onCustomerRenamed } from "../crm/customer-names";
import { QuoteModel } from "./database";

/**
 * Rewrites the customer name of the quotes where it drifted. A quote stores its
 * customer's name next to its id so the search box of the quotes table finds it
 * by customer (a search reads stored fields, not the joined customer). Runs
 * after each quote write and each customer rename.
 */
async function syncQuoteCustomerNames(): Promise<void> {
  const model = GetModel(QuoteModel);
  const [quotes, customers] = await Promise.all([
    model.getAll(),
    GetModel(CustomerModel).getAll(),
  ]);
  const names = new Map(customers.map(({ _id, name }) => [_id, name]));
  const stale = quotes
    .map((quote) => ({ quote, name: names.get(quote.customer) ?? "" }))
    .filter(({ quote, name }) => quote.customerName !== name);
  await Promise.all(
    stale.map(({ quote, name }) =>
      model.update(quote._id, { customerName: name }),
    ),
  );
}

onCustomerRenamed(syncQuoteCustomerNames);

/** The quotes table's new and edit guard result. */
export const afterQuoteWrite: AfterWrite = syncQuoteCustomerNames;
