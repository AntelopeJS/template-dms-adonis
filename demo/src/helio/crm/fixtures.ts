import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { COUNTS, customerId, dealId, teamIdsByRole } from "../shared/roster";
import {
  cents,
  createRng,
  DAY_MS,
  daysFromNow,
  type Rng,
} from "../shared/seed";
import type { CustomerKind, DealStage, LeadSource } from "./database";
import { BUSINESSES, type BusinessSeed } from "./seed-businesses";
import {
  FIRST_NAMES,
  LAST_NAMES,
  LOCALITIES,
  type Locality,
  localityIndex,
  MAIL_DOMAINS,
  NEXT_STEPS,
  RESIDENTIAL_NOTES,
} from "./seed-data";
import { helioNow } from "../shared/clock";

export interface CustomerSeed {
  _id: string;
  kind: CustomerKind;
  name: string;
  vatNumber?: string;
  contactName: string;
  email: string;
  phone: string;
  address: DefaultDataTypes.Address;
  segments: string[];
  source: LeadSource;
  isVip: boolean;
  owner: string;
  website?: string;
  notes?: string;
  createdAt: Date;
  isArchived: boolean;
}

export interface DealSeed {
  _id: string;
  title: string;
  customer: string;
  /** The customer's name, stored so the pipeline search finds it. */
  customerName: string;
  owner: string;
  stage: DealStage;
  amount: number;
  probability: number;
  /** amount × probability, stored so the pipeline lists and sums it. */
  weightedAmount: number;
  /** Neither won nor lost, stored so the pipeline views filter on it. */
  isOpen: boolean;
  source: LeadSource;
  expectedClose: Date;
  lastActivityAt: Date;
  nextStep?: string;
  lostReason?: string;
}

/** The won deals are deal-001 … deal-0NN, oldest first. */
export const WON_DEAL_COUNT = 40;

/** The default win probability of each stage. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 0.1,
  qualified: 0.25,
  site_visit: 0.4,
  proposal: 0.6,
  negotiation: 0.8,
  won: 1,
  lost: 0,
};

const SALES_REPS = teamIdsByRole("sales");
/** The key account manager, who follows most business accounts. */
const KEY_ACCOUNT_MANAGER = "team-03";
const VIP_RESIDENTIAL = new Set([8, 22, 44]);
const ARCHIVED = new Set([13, 29, 41, 52, 57]);

const SOURCES: ReadonlyArray<readonly [LeadSource, number]> = [
  ["website", 35],
  ["referral", 25],
  ["partner", 15],
  ["phone", 15],
  ["fair", 10],
];

const RESIDENTIAL_SEGMENTS = [
  "photovoltaïque",
  "batterie",
  "borne",
  "entretien",
  "prime",
];

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function mobilePhone(rng: Rng): string {
  return `+32 4${rng.int(70, 99)} ${pad2(rng.int(0, 99))} ${pad2(rng.int(0, 99))} ${pad2(rng.int(0, 99))}`;
}

/**
 * Belgian area codes: one digit for Liège and Brussels (7-digit numbers), two
 * elsewhere (6-digit numbers).
 */
const AREA_CODES = new Map([
  ["Liège", "4"],
  ["Bruxelles-Capitale", "2"],
  ["Namur", "81"],
  ["Hainaut", "71"],
  ["Luxembourg", "84"],
  ["Brabant wallon", "10"],
]);

/**
 * A company switchboard number in its area. It draws as many values whatever
 * the area, so the rest of the customer stays the same.
 */
function landline(rng: Rng, province: string): string {
  const area = AREA_CODES.get(province) ?? "4";
  const lead = rng.chance(0.5) ? "2" : "3";
  const middle = rng.int(10, 99);
  const tail = `${pad2(rng.int(0, 99))} ${pad2(rng.int(0, 99))}`;
  return area.length === 1
    ? `+32 ${area} ${lead}${middle} ${tail}`
    : `+32 ${area} ${middle} ${tail}`;
}

/**
 * The businesses' names read as Belgian domains (garage-delvaux.be); their
 * e-mail and website use the reserved `.example` top-level domain instead, so
 * no seeded address or link points at a real company.
 */
function fictionalDomain(domain: string): string {
  return domain.replace(/\.[a-z]+$/, ".example");
}

/**
 * A valid Belgian VAT number: 0 + 7 digits, then 97 − (those 8 digits mod 97).
 */
function vatNumber(index: number): string {
  const base = 4_000_000 + ((index * 137_731) % 5_999_999);
  const check = pad2(97 - (base % 97));
  const digits = `0${base}${check}`;
  return `BE${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
}

/**
 * An address in `locality`. About 15 % of addresses get a box number, which never
 * repeats the house number ("10 bte 10" reads as a typo).
 */
function address(rng: Rng, locality: Locality): DefaultDataTypes.Address {
  const result: DefaultDataTypes.Address = {
    streetName: rng.pick(locality.streets),
    houseNumber: String(rng.int(1, 220)),
    postalCode: locality.postalCode,
    city: locality.city,
    countrySubdivision: locality.province,
    countryCode: "BE",
  };
  if (rng.chance(0.15)) {
    const box = rng.int(1, 12);
    result.boxNumber = String(
      String(box) === result.houseNumber ? (box % 12) + 1 : box,
    );
  }
  return result;
}

/** Residential customers live mostly around Liège, where Helio is based. */
function residentialLocality(rng: Rng): Locality {
  const liegeProvince = LOCALITIES.slice(0, 12);
  return rng.chance(0.6) ? rng.pick(liegeProvince) : rng.pick(LOCALITIES);
}

function pickSome(
  rng: Rng,
  items: readonly string[],
  min: number,
  max: number,
): string[] {
  const wanted = rng.int(min, max);
  const picked = new Set<string>();
  while (picked.size < wanted) picked.add(rng.pick(items));
  return [...picked];
}

function residentialCustomer(
  index: number,
  order: number,
  rng: Rng,
): CustomerSeed {
  const first = FIRST_NAMES[(order * 7) % FIRST_NAMES.length] ?? "Marie";
  const last =
    LAST_NAMES[(order * 11 + 3 + Math.floor(order / 30)) % LAST_NAMES.length] ??
    "Dupont";
  const name = `${first} ${last}`;
  return {
    _id: customerId(index),
    kind: "residential",
    name,
    contactName: name,
    email: `${slug(first)}.${slug(last)}@${rng.pick(MAIL_DOMAINS)}`,
    phone: mobilePhone(rng),
    address: address(rng, residentialLocality(rng)),
    segments: pickSome(rng, RESIDENTIAL_SEGMENTS, 1, 3),
    source: rng.weighted(SOURCES),
    isVip: VIP_RESIDENTIAL.has(index),
    owner: rng.pick(SALES_REPS),
    notes: rng.chance(0.6) ? rng.pick(RESIDENTIAL_NOTES) : undefined,
    createdAt: daysFromNow(-rng.int(10, 1100), rng.int(8, 18)),
    isArchived: ARCHIVED.has(index),
  };
}

function businessCustomer(
  index: number,
  business: BusinessSeed,
  rng: Rng,
): CustomerSeed {
  const locality = LOCALITIES[localityIndex(business.city)];
  if (!locality) throw new Error(`Unknown locality ${business.city}`);
  const [contactFirst = "contact"] = business.contactName.split(" ");
  return {
    _id: customerId(index),
    kind: "business",
    name: business.name,
    vatNumber: vatNumber(index),
    contactName: business.contactName,
    email: `${slug(contactFirst)}@${fictionalDomain(business.domain)}`,
    phone: landline(rng, locality.province),
    address: address(rng, locality),
    segments: [...business.segments],
    source: rng.weighted(SOURCES),
    isVip: business.isVip ?? false,
    owner: rng.chance(0.7) ? KEY_ACCOUNT_MANAGER : rng.pick(SALES_REPS),
    website: `https://www.${fictionalDomain(business.domain)}`,
    notes: `<p>${business.notes}</p>`,
    createdAt: daysFromNow(-rng.int(30, 1100), rng.int(8, 18)),
    isArchived: ARCHIVED.has(index),
  };
}

let customerCache: CustomerSeed[] | undefined;

/**
 * The 60 generated customers: every third one is a business. They are
 * deterministic (a seeded PRNG) with dates relative to now, so other domains
 * read them through this function, {@link buildDeals} and {@link wonDeals} to
 * stay coherent.
 */
export function buildCustomers(): CustomerSeed[] {
  customerCache ??= Array.from({ length: COUNTS.customers }, (_, offset) => {
    const index = offset + 1;
    const rng = createRng(1000 + index);
    const business = index % 3 === 0 ? BUSINESSES[index / 3 - 1] : undefined;
    if (business) return businessCustomer(index, business, rng);
    return residentialCustomer(index, offset - Math.floor(index / 3), rng);
  });
  return customerCache;
}

const OPEN_STAGE_COUNTS: ReadonlyArray<readonly [DealStage, number]> = [
  ["lead", 14],
  ["qualified", 13],
  ["site_visit", 12],
  ["proposal", 14],
  ["negotiation", 11],
  ["lost", 16],
];

const LOST_REASON_VALUES = [
  "price",
  "competitor",
  "timing",
  "financing",
  "roof",
  "no_response",
];
const BUSINESS_SITES = ["entrepôt", "atelier", "hangar", "bureaux", "magasin"];

function decimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function dealAmount(rng: Rng, customer: CustomerSeed): number {
  if (customer.kind === "residential") {
    const amount = rng.int(6000, customer.isVip ? 25_000 : 19_000);
    return Math.round(amount / 50) * 50;
  }
  const amount = customer.isVip
    ? rng.int(90_000, 250_000)
    : rng.int(30_000, 140_000);
  return Math.round(amount / 100) * 100;
}

function dealTitle(rng: Rng, customer: CustomerSeed, amount: number): string {
  if (customer.kind === "residential") {
    const kwp = decimal(Math.min(Math.max(amount / 1900, 3), 12));
    return rng.pick([
      `Installation ${kwp} kWc`,
      `Installation ${kwp} kWc + batterie ${rng.pick([5, 10, 15])} kWh`,
      `Borne 11 kW + installation ${kwp} kWc`,
      `Installation ${kwp} kWc, panneaux full black`,
    ]);
  }
  const kwp = Math.round(amount / 1050);
  return rng.pick([
    `Toiture PV ${kwp} kWc – ${rng.pick(BUSINESS_SITES)}`,
    `Carport solaire ${kwp} kWc`,
    `PV ${kwp} kWc + stockage ${rng.pick([30, 60, 100])} kWh`,
    `Bornes de recharge parking (${rng.int(4, 16)} points) + PV ${kwp} kWc`,
  ]);
}

/**
 * A seeded Fisher–Yates shuffle, so the stages are mixed but always in the same
 * order.
 */
function shuffled<T>(rng: Rng, items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const current = result[i];
    const other = result[j];
    if (current === undefined || other === undefined) continue;
    result[i] = other;
    result[j] = current;
  }
  return result;
}

function minutesAgo(minutes: number): Date {
  return new Date(helioNow() - minutes * 60_000);
}

interface DealDraft {
  index: number;
  customer: CustomerSeed;
  stage: DealStage;
  rng: Rng;
}

function baseDeal({ index, customer, stage, rng }: DealDraft): DealSeed {
  const amount = dealAmount(rng, customer);
  const steps = NEXT_STEPS[stage];
  const deal: DealSeed = {
    _id: dealId(index),
    title: dealTitle(rng, customer, amount),
    customer: customer._id,
    customerName: customer.name,
    owner: customer.owner,
    stage,
    amount,
    probability: STAGE_PROBABILITY[stage],
    weightedAmount: 0,
    isOpen: stage !== "won" && stage !== "lost",
    source: rng.chance(0.8) ? customer.source : rng.weighted(SOURCES),
    expectedClose: daysFromNow(30),
    lastActivityAt: daysFromNow(-1),
  };
  if (steps.length > 0) deal.nextStep = rng.pick(steps);
  return deal;
}

/** Won deals close one after the other over the last twelve months. */
function wonDeal(draft: DealDraft): DealSeed {
  const daysAgo = Math.round(
    360 - ((draft.index - 1) * 355) / (WON_DEAL_COUNT - 1),
  );
  return {
    ...baseDeal(draft),
    expectedClose: daysFromNow(-daysAgo, draft.rng.int(9, 17)),
    lastActivityAt: daysFromNow(
      -daysAgo + draft.rng.int(0, 3),
      draft.rng.int(9, 17),
    ),
  };
}

function lostDeal(draft: DealDraft): DealSeed {
  const daysAgo = draft.rng.int(10, 300);
  return {
    ...baseDeal(draft),
    expectedClose: daysFromNow(-daysAgo, 12),
    lastActivityAt: daysFromNow(
      -daysAgo - draft.rng.int(0, 10),
      draft.rng.int(9, 17),
    ),
    lostReason: draft.rng.pick(LOST_REASON_VALUES),
  };
}

/**
 * Open deals: closing in the coming months (a few already overdue), most
 * touched recently, about a quarter stalled for more than three weeks.
 */
function openDeal(draft: DealDraft): DealSeed {
  const { rng, stage } = draft;
  const overdue = rng.chance(0.1);
  const activity = rng.chance(0.25)
    ? daysFromNow(-rng.int(22, 60), rng.int(9, 17))
    : minutesAgo(rng.int(20, 14 * 24 * 60));
  const nudge = rng.int(-1, 1) * 0.05;
  return {
    ...baseDeal(draft),
    probability: cents(STAGE_PROBABILITY[stage] + nudge),
    expectedClose: daysFromNow(overdue ? -rng.int(1, 15) : rng.int(3, 120), 12),
    lastActivityAt: activity,
  };
}

let dealCache: DealSeed[] | undefined;

/**
 * The 120 generated deals: deal-001 … deal-040 won, in the order they were
 * closed, and the rest spread over the pipeline. A lost deal may belong to a
 * customer archived since. The weighted amount is computed once the
 * probability is final, since open deals nudge theirs.
 */
export function buildDeals(): DealSeed[] {
  if (dealCache) return dealCache;
  const customers = buildCustomers();
  const active = customers.filter((customer) => !customer.isArchived);
  const at = (list: CustomerSeed[], position: number): CustomerSeed => {
    const customer = list[position % list.length];
    if (!customer) throw new Error("No customer to attach a deal to");
    return customer;
  };
  const stages = shuffled(
    createRng(4242),
    OPEN_STAGE_COUNTS.flatMap(([stage, count]) =>
      Array.from({ length: count }, () => stage),
    ),
  );
  const drafts = Array.from({ length: COUNTS.deals }, (_, offset) => {
    const index = offset + 1;
    const rng = createRng(5000 + index);
    if (index <= WON_DEAL_COUNT) {
      return wonDeal({
        index,
        customer: at(active, index * 13),
        stage: "won",
        rng,
      });
    }
    const stage = stages[index - WON_DEAL_COUNT - 1] ?? "lead";
    if (stage === "lost")
      return lostDeal({
        index,
        customer: at(customers, index * 7),
        stage,
        rng,
      });
    return openDeal({
      index,
      customer: at(active, index * 17 + 5),
      stage,
      rng,
    });
  });
  dealCache = drafts.map((deal) => ({
    ...deal,
    weightedAmount: cents(deal.amount * deal.probability),
  }));
  return dealCache;
}

export interface WonDealFact {
  dealId: string;
  customerId: string;
  customerKind: CustomerKind;
  owner: string;
  title: string;
  /** Amount excluding VAT, in euros. */
  amount: number;
  /** When the deal was signed (its expectedClose). */
  closedAt: Date;
}

/** deal-001 … deal-040 with what accepted quotes and projects need, oldest first. */
export function wonDeals(): WonDealFact[] {
  const customers = new Map(
    buildCustomers().map((customer) => [customer._id, customer]),
  );
  return buildDeals()
    .filter((deal) => deal.stage === "won")
    .map((deal) => ({
      dealId: deal._id,
      customerId: deal.customer,
      customerKind: customers.get(deal.customer)?.kind ?? "residential",
      owner: deal.owner,
      title: deal.title,
      amount: deal.amount,
      closedAt: deal.expectedClose,
    }));
}

/** The customer of won deal `index` (1 … WON_DEAL_COUNT). */
export function wonDealCustomer(index: number): string {
  const deal = buildDeals()[index - 1];
  if (!deal || deal.stage !== "won")
    throw new Error(`deal-${index} is not a won deal`);
  return deal.customer;
}

/** Days between a won deal's signature and now, handy to age its project. */
export function daysSinceWon(fact: WonDealFact): number {
  return Math.round((helioNow() - fact.closedAt.getTime()) / DAY_MS);
}
