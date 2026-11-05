import {
  buildCustomers,
  buildDeals,
  type CustomerSeed,
  type DealSeed,
} from "../crm/fixtures";

/**
 * A seeded customer as the operations fixtures read it, from the CRM's own
 * deterministic generators, so quotes, projects, sites, tickets and invoices
 * point at matching customers.
 */
export type CustomerFacts = CustomerSeed;
/** A seeded deal, whose `customer` is the customer it belongs to. */
export type DealFacts = DealSeed;

/** Cached customers of the CRM seed, built on first use. */
let customers: Map<string, CustomerFacts> | undefined;
/** Cached deals of the CRM seed, built on first use. */
let deals: Map<string, DealFacts> | undefined;

function customerMap(): Map<string, CustomerFacts> {
  customers ??= new Map(buildCustomers().map((row) => [row._id, row]));
  return customers;
}

function dealMap(): Map<string, DealFacts> {
  deals ??= new Map(buildDeals().map((row) => [row._id, row]));
  return deals;
}

/** A seeded customer, or undefined for one created since (or unknown). */
export function findCustomerFacts(id: string): CustomerFacts | undefined {
  return customerMap().get(id);
}

export function customerFacts(id: string): CustomerFacts {
  const found = customerMap().get(id);
  if (!found) throw new Error(`Unknown Helio customer ${id}`);
  return found;
}

export function dealFacts(id: string): DealFacts {
  const found = dealMap().get(id);
  if (!found) throw new Error(`Unknown Helio deal ${id}`);
  return found;
}

/** Customers still active (not archived), the ones new work is sold to. */
export function activeCustomers(): CustomerFacts[] {
  return [...customerMap().values()].filter((row) => !row.isArchived);
}

export const isBusiness = (customer: CustomerFacts): boolean =>
  customer.kind === "business";
