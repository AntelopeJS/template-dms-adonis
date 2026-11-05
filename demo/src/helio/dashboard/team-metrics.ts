import { GetModel } from "@antelopejs/interface-database-decorators";
import type { ComposedText } from "@antelopejs/interface-dms/base/types/composed-text";
import { CustomerModel, DealModel } from "../crm/database";
import type { Quote } from "../sales/database";
import { type TeamMember, TeamMemberModel } from "../team/database";
import { HELIO_PAGES } from "./links";
import {
  deltaPercent,
  type Period,
  roundAmount,
  slices,
  sumByRange,
  type TimeRange,
  within,
} from "./period";
import { acceptedQuotes } from "./sales-metrics";

export interface TopListItemPayload {
  id: string;
  title: string;
  description: ComposedText;
  value: number;
  delta: number | null;
  sparkline: number[];
  avatar?: { src: string; alt: string };
  to: string;
}

async function ownerOfQuote(): Promise<(quote: Quote) => string | undefined> {
  const [deals, customers] = await Promise.all([
    GetModel(DealModel).getAll(),
    GetModel(CustomerModel).getAll(),
  ]);
  const dealOwner = new Map(deals.map((deal) => [deal._id, deal.owner]));
  const accountOwner = new Map(
    customers.map((customer) => [customer._id, customer.owner]),
  );
  return (quote) =>
    (quote.deal ? dealOwner.get(quote.deal) : undefined) ??
    accountOwner.get(quote.customer);
}

function signedIn(quotes: readonly Quote[], range: TimeRange): number {
  return quotes.reduce(
    (total, quote) =>
      within(quote.signedAt, range) ? total + quote.subtotal : total,
    0,
  );
}

/**
 * One leaderboard row. It links to the pipeline filtered on the rep (its
 * `owner` query filter).
 */
function repItem(
  member: TeamMember,
  quotes: readonly Quote[],
  period: Period,
): TopListItemPayload {
  const value = signedIn(quotes, period.range);
  const count = quotes.filter((quote) =>
    within(quote.signedAt, period.range),
  ).length;
  const previous = period.compare
    ? signedIn(quotes, period.compare)
    : undefined;
  return {
    id: member._id,
    title: member.name,
    description: {
      key: "$helio.dashboard.topReps.signed",
      params: { count: { type: "count", value: count } },
    },
    value: roundAmount(value),
    delta: deltaPercent(value, previous),
    sparkline: sumByRange(
      quotes,
      slices(period.range, 8),
      (quote) => quote.signedAt,
      (quote) => quote.subtotal,
    ).map(roundAmount),
    avatar: member.avatar
      ? { src: member.avatar, alt: member.name }
      : undefined,
    to: `${HELIO_PAGES.pipeline}?owner=${encodeURIComponent(member._id)}`,
  };
}

/**
 * The sales leaderboard: every sales rep, best first, with what they signed
 * in the period. A quote is credited to its deal's owner or, without a deal,
 * to the customer's account owner.
 */
export async function topReps(
  period: Period,
): Promise<{ items: TopListItemPayload[] }> {
  const [quotes, ownerOf, team] = await Promise.all([
    acceptedQuotes(),
    ownerOfQuote(),
    GetModel(TeamMemberModel).getAll(),
  ]);
  const reps = team.filter((member) => member.role === "sales");
  const items = reps
    .map((member) =>
      repItem(
        member,
        quotes.filter((quote) => ownerOf(quote) === member._id),
        period,
      ),
    )
    .sort((a, b) => b.value - a.value);
  return { items };
}
