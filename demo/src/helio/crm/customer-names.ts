import type { AfterWrite } from "@antelopejs/interface-dms/base/types/guards";
import { syncDerivedFields } from "./deal-derived";

type NameSync = () => Promise<void>;

/**
 * The syncs run after a customer rename. Deals and quotes store their
 * customer's name next to its id, so the search box of their tables finds them
 * by customer (a search reads stored fields, not the joined customer). A rename
 * brings them back in step: the deals directly, the quotes through the listener
 * the sales domain registers with {@link onCustomerRenamed} (sales imports the
 * CRM, not the other way round).
 */
const listeners: NameSync[] = [];

/** Runs `sync` after every customer rename. */
export function onCustomerRenamed(sync: NameSync): void {
  listeners.push(sync);
}

/** The customers table's edit guard result once a customer was renamed. */
export const afterCustomerEdit: AfterWrite = async () => {
  await Promise.all([syncDerivedFields(), ...listeners.map((sync) => sync())]);
};
