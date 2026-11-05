import { GetModel } from "@antelopejs/interface-database-decorators";
import { DealModel } from "./database";
import { OPEN_DEAL_STAGES } from "./deal-controller";

/** How many deals of these customers are open, won and lost. */
export interface CustomerDealCounts {
  open: number;
  closed: number;
}

/** Counts the deals of the given customers, by whether they are still in play. */
export async function countCustomerDeals(
  customerIds: string[],
): Promise<CustomerDealCounts> {
  const model = GetModel(DealModel);
  const lists = await Promise.all(
    customerIds.map((id) => model.getBy("customer", id)),
  );
  const deals = lists.flat();
  const open = deals.filter((deal) =>
    OPEN_DEAL_STAGES.includes(deal.stage),
  ).length;
  return { open, closed: deals.length - open };
}
