import { GetModel } from "@antelopejs/interface-database-decorators";
import { tableViewRowTopic } from "@antelopejs/interface-dms/base/table-view";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { CustomerModel, type Deal, DealModel } from "../crm/database";
import { type ActivityEntry, logActivity } from "../dashboard/log";
import type { Quote } from "./database";
import { helioNow } from "../shared/clock";

/** The pipeline table's route, on which it listens for rows changed outside its own routes. */
const PIPELINE_LOCATION = "/api/helio/deals";

interface QuoteContext {
  deal?: Deal;
  owner?: string;
  subject: string;
}

/**
 * The quote's deal, its salesperson (the deal's owner, else the customer's
 * account manager) and how the feed names it: "Q-2026-0042 · Dupont".
 */
async function contextOf(quote: Quote): Promise<QuoteContext> {
  const [deal, customer] = await Promise.all([
    quote.deal ? GetModel(DealModel).get(quote.deal) : undefined,
    GetModel(CustomerModel).get(quote.customer),
  ]);
  return {
    deal,
    owner: deal?.owner ?? customer?.owner,
    subject: [quote.number, customer?.name].filter(Boolean).join(" · "),
  };
}

/**
 * Logs a quote sent to its customer to the dashboard's activity feed, in the
 * name of its salesperson. Nothing is logged for a quote that has none.
 */
export async function quoteSent(quote: Quote): Promise<void> {
  const { owner, subject } = await contextOf(quote);
  if (!owner) return;
  await logActivity({
    type: "quote_sent",
    actor: owner,
    subject,
    record: { kind: "quote", id: quote._id },
  });
}

/**
 * Closes the deal of a signed quote as won, at the quote's subtotal, and tells
 * the pipeline table to refresh the row.
 */
async function winDeal(deal: Deal, quote: Quote): Promise<void> {
  const now = new Date(helioNow());
  await GetModel(DealModel).update(deal._id, {
    stage: "won",
    isOpen: false,
    probability: 1,
    amount: quote.subtotal,
    weightedAmount: quote.subtotal,
    expectedClose: now,
    lastActivityAt: now,
    nextStep: undefined,
  });
  await PublishMessage(tableViewRowTopic(PIPELINE_LOCATION), "updated", {
    payload: { ids: [deal._id] },
  });
}

/**
 * A quote the customer signed: its deal is won (unless it was already), and
 * both events reach the activity feed.
 */
export async function quoteAccepted(quote: Quote): Promise<void> {
  const { deal, owner, subject } = await contextOf(quote);
  const entries: ActivityEntry[] = [];
  if (owner) {
    entries.push({
      type: "quote_accepted",
      actor: owner,
      subject,
      record: { kind: "quote", id: quote._id },
    });
  }
  if (deal && deal.stage !== "won") {
    await winDeal(deal, quote);
    entries.push({
      type: "deal_won",
      actor: deal.owner,
      subject: deal.title,
      record: { kind: "deal", id: deal._id },
    });
  }
  await logActivity(...entries);
}
