import { buildQuotes } from "../sales/fixtures";
import { createRng, DAY_MS } from "../shared/seed";
import { buildDeals, type CustomerSeed } from "./fixtures";
import { helioNow } from "../shared/clock";

function earliestByCustomer(): Map<string, number> {
  const earliest = new Map<string, number>();
  const note = (customer: string, date: Date | undefined) => {
    const time = date?.getTime();
    if (time === undefined || time > helioNow()) return;
    earliest.set(customer, Math.min(earliest.get(customer) ?? time, time));
  };
  for (const deal of buildDeals()) {
    note(deal.customer, deal.lastActivityAt);
    note(deal.customer, deal.expectedClose);
  }
  for (const quote of buildQuotes()) note(quote.customer, quote.issuedAt);
  return earliest;
}

/**
 * The customers, each created at least ten days before their first business.
 * A customer exists before anything is sold to them: the seeded creation date
 * (the first contact) moves back before the customer's first deal activity or
 * first quote, whichever came first, so no deal is won and no quote issued for
 * a customer the CRM did not know yet.
 */
export function withFirstContact(customers: CustomerSeed[]): CustomerSeed[] {
  const rng = createRng(0x9e11000b);
  const earliest = earliestByCustomer();
  return customers.map((customer) => {
    const first = earliest.get(customer._id);
    if (first === undefined) return customer;
    const latest = first - rng.int(10, 60) * DAY_MS;
    if (customer.createdAt.getTime() <= latest) return customer;
    const createdAt = new Date(latest);
    createdAt.setHours(rng.int(9, 17), 0, 0, 0);
    return { ...customer, createdAt };
  });
}
