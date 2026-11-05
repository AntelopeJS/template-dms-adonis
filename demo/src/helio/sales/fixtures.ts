import {
  activeCustomers,
  type CustomerFacts,
  customerFacts,
  type DealFacts,
  dealFacts,
  isBusiness,
} from "../projects/crm-facts";
import { projectPlans } from "../projects/plan";
import { COUNTS, dealId, quoteId } from "../shared/roster";
import { createRng, DAY_MS, daysFromNow, type Rng } from "../shared/seed";
import type { Quote, QuoteLine, QuoteStatus } from "./database";
import {
  buildLines,
  fitPvLines,
  quoteTotals,
  VAT_BUSINESS,
  VAT_RESIDENTIAL,
} from "./lines";

export type QuoteSeed = Pick<
  Quote,
  | "_id"
  | "number"
  | "customer"
  | "customerName"
  | "deal"
  | "status"
  | "lines"
  | "subtotal"
  | "vatRate"
  | "total"
  | "issuedAt"
  | "validUntil"
  | "sentAt"
  | "signedAt"
  | "portalToken"
  | "notes"
>;

const VALIDITY_DAYS = 30;
const FIRST_OPEN_DEAL = 41;

const NOTES = [
  "Pose prévue en semaine, accès au toit par l'arrière de la maison.",
  "Prime Qualiwatt non applicable, le client a été informé.",
  "Variante avec batterie envoyée séparément sur demande du client.",
  "Raccordement au réseau RESA à confirmer après la visite technique.",
  "Toiture en ardoises : crochets spécifiques prévus dans le prix.",
  "Le client souhaite un paiement en trois tranches.",
];

function portalToken(rng: Rng): string {
  return Array.from({ length: 24 }, () => rng.int(0, 15).toString(16)).join("");
}

function at(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

interface QuoteDraft {
  _id: string;
  customer: CustomerFacts;
  deal?: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  issuedAt: Date;
  sentAt?: Date;
  signedAt?: Date;
}

function toSeed(rng: Rng, draft: QuoteDraft): QuoteSeed {
  const vatRate = isBusiness(draft.customer) ? VAT_BUSINESS : VAT_RESIDENTIAL;
  const { subtotal, total } = quoteTotals(draft.lines, vatRate);
  return {
    _id: draft._id,
    number: "",
    customer: draft.customer._id,
    customerName: draft.customer.name,
    deal: draft.deal,
    status: draft.status,
    lines: draft.lines,
    subtotal,
    vatRate,
    total,
    issuedAt: draft.issuedAt,
    validUntil: new Date(draft.issuedAt.getTime() + VALIDITY_DAYS * DAY_MS),
    sentAt: draft.sentAt,
    signedAt: draft.signedAt,
    portalToken: portalToken(rng),
    notes: rng.chance(0.3) ? rng.pick(NOTES) : undefined,
  };
}

/**
 * The signed quote of each planned project, issued 4 to 21 days before its
 * signature.
 */
function acceptedQuotes(rng: Rng): QuoteDraft[] {
  return projectPlans().map((plan) => {
    const issuedAt = at(plan.signedAt, -24 * rng.int(4, 21));
    return {
      _id: plan.quoteId,
      customer: plan.customer,
      deal: plan.dealId,
      status: "accepted",
      lines: plan.lines,
      issuedAt,
      sentAt: at(issuedAt, rng.int(1, 6)),
      signedAt: plan.signedAt,
    };
  });
}

/** The issue date, in days from now (negative: in the past), of a quote of the given status. */
function issueDay(rng: Rng, status: QuoteStatus): number {
  switch (status) {
    case "draft":
      return -rng.int(0, 6);
    case "sent":
      return -rng.int(1, 28);
    case "rejected":
      return -rng.int(15, 320);
    default:
      return -rng.int(45, 340);
  }
}

function statusForStage(rng: Rng, stage: string): QuoteStatus | undefined {
  switch (stage) {
    case "proposal":
      return "sent";
    case "negotiation":
      return rng.chance(0.7) ? "sent" : "draft";
    case "site_visit":
      return rng.chance(0.5) ? "draft" : undefined;
    case "lost":
      return rng.chance(0.6) ? "rejected" : "expired";
    default:
      return undefined;
  }
}

function standaloneLines(rng: Rng, customer: CustomerFacts): QuoteLine[] {
  const business = isBusiness(customer);
  const type = business
    ? rng.pick(["commercial_pv", "commercial_pv", "ev_charger"] as const)
    : rng.pick([
        "residential_pv",
        "residential_pv",
        "battery",
        "ev_charger",
      ] as const);
  return buildLines(rng, type, business, customer.isVip).lines;
}

/**
 * A quote for a pipeline deal or a standalone request. A deal's quote prices
 * its amount; a lost deal's quote was issued 10 to 35 days before the deal's
 * close date.
 */
function openQuote(
  rng: Rng,
  index: number,
  customer: CustomerFacts,
  status: QuoteStatus,
  deal?: DealFacts,
): QuoteDraft {
  const lines = deal
    ? fitPvLines(rng, isBusiness(customer), customer.isVip, deal.amount).lines
    : standaloneLines(rng, customer);
  const issuedAt =
    deal?.stage === "lost"
      ? at(deal.expectedClose, -24 * rng.int(10, 35))
      : daysFromNow(issueDay(rng, status), rng.int(8, 17));
  return {
    _id: quoteId(index),
    customer,
    deal: deal?._id,
    status,
    lines,
    issuedAt,
    sentAt: status === "draft" ? undefined : at(issuedAt, rng.int(1, 6)),
  };
}

/**
 * Quotes of the deals still in the pipeline (or lost), then standalone
 * requests until the collection holds COUNTS.quotes rows.
 */
function otherQuotes(rng: Rng, firstIndex: number): QuoteDraft[] {
  const drafts: QuoteDraft[] = [];
  for (let deal = FIRST_OPEN_DEAL; deal <= COUNTS.deals; deal++) {
    if (firstIndex + drafts.length > COUNTS.quotes) break;
    const facts = dealFacts(dealId(deal));
    const status = statusForStage(rng, facts.stage);
    if (status) {
      const index = firstIndex + drafts.length;
      drafts.push(
        openQuote(rng, index, customerFacts(facts.customer), status, facts),
      );
    }
  }
  const customers = activeCustomers();
  while (firstIndex + drafts.length <= COUNTS.quotes) {
    const status = rng.weighted<QuoteStatus>([
      ["expired", 4],
      ["rejected", 3],
      ["sent", 2],
      ["draft", 1],
    ]);
    drafts.push(
      openQuote(rng, firstIndex + drafts.length, rng.pick(customers), status),
    );
  }
  return drafts;
}

/** Numbers the seeds by issue date within each year: Q-2026-0001, … */
function numberQuotes(seeds: QuoteSeed[]): void {
  const counters = new Map<number, number>();
  for (const seed of [...seeds].sort(
    (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
  )) {
    const year = seed.issuedAt.getFullYear();
    const next = (counters.get(year) ?? 0) + 1;
    counters.set(year, next);
    seed.number = `Q-${year}-${String(next).padStart(4, "0")}`;
  }
}

let quotes: QuoteSeed[] | undefined;

/**
 * The 150 quotes, `quote-001` … `quote-150`. Quotes 1–80 are the signed quotes
 * behind the 80 projects (see projects/plan.ts); the other 70 follow the open
 * and lost deals of the pipeline, or are standalone requests, spread over the
 * year.
 */
export function buildQuotes(): QuoteSeed[] {
  if (!quotes) {
    const rng = createRng(0x9e110002);
    const accepted = acceptedQuotes(rng);
    const drafts = [...accepted, ...otherQuotes(rng, accepted.length + 1)];
    quotes = drafts.map((draft) => toSeed(rng, draft));
    numberQuotes(quotes);
  }
  return quotes;
}
