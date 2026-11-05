import { PRODUCT_ROSTER } from "../shared/roster";
import { cents, type Rng } from "../shared/seed";
import type { QuoteLine } from "./database";

export type InstallationType =
  | "residential_pv"
  | "commercial_pv"
  | "battery"
  | "ev_charger";

export interface LineSet {
  lines: QuoteLine[];
  /** Peak power of the panels quoted, 0 without panels. */
  capacityKwp: number;
}

/** Belgian VAT: 6% on renovation works for homes, 21% for businesses. */
export const VAT_RESIDENTIAL = 0.06;
export const VAT_BUSINESS = 0.21;

function product(id: string) {
  const found = PRODUCT_ROSTER.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown product ${id}`);
  return found;
}

function line(id: string, qty: number, label?: string): QuoteLine {
  const entry = product(id);
  return {
    product: entry.id,
    label: label ?? entry.name,
    qty,
    unitPrice: entry.price,
  };
}

function kwp(panelId: string, count: number): number {
  return Math.round((product(panelId).power * count) / 100) / 10;
}

/**
 * The options of a solar array drawn once, so its panel count can then be
 * chosen freely (randomly, or to match a won deal's amount).
 */
interface PvOptions {
  panel: string;
  battery?: string;
  charger?: number;
  business: boolean;
}

function drawPv(rng: Rng, business: boolean, vip: boolean): PvOptions {
  if (business) {
    return {
      panel: rng.pick(["prod-04", "prod-05"]),
      charger: rng.chance(0.5) ? rng.int(2, 6) : undefined,
      business,
    };
  }
  return {
    panel: rng.pick(["prod-01", "prod-02", "prod-03"]),
    battery: rng.chance(vip ? 0.7 : 0.35)
      ? rng.pick(["prod-12", "prod-13"])
      : undefined,
    charger: rng.chance(0.25) ? 1 : undefined,
    business,
  };
}

function residentialPv(options: PvOptions, count: number): LineSet {
  const capacityKwp = kwp(options.panel, count);
  const lines = [
    line(options.panel, count),
    options.battery
      ? line("prod-09", 1)
      : line(capacityKwp > 6 ? "prod-07" : "prod-06", 1),
    line("prod-20", 1),
    line("prod-18", 1),
  ];
  if (options.battery) lines.push(line(options.battery, 1));
  if (options.charger) lines.push(line("prod-16", options.charger));
  lines.push(line("prod-23", 1));
  return { lines, capacityKwp };
}

function commercialPv(options: PvOptions, count: number): LineSet {
  const capacityKwp = kwp(options.panel, count);
  const lines = [
    line(options.panel, count),
    line("prod-08", Math.max(1, Math.ceil(capacityKwp / 30))),
    line("prod-20", 1),
    line("prod-19", Math.round(capacityKwp)),
    line("prod-22", 1),
    line("prod-23", 1),
  ];
  if (options.charger) lines.push(line("prod-17", options.charger));
  return { lines, capacityKwp };
}

function pvLines(options: PvOptions, count: number): LineSet {
  return options.business
    ? commercialPv(options, count)
    : residentialPv(options, count);
}

function randomCount(rng: Rng, business: boolean, vip: boolean): number {
  if (business) return rng.int(vip ? 120 : 50, vip ? 380 : 160);
  return rng.int(vip ? 18 : 10, vip ? 30 : 22);
}

/**
 * The lines of a solar array whose subtotal comes closest to `target` (a
 * won deal's amount, excluding VAT): the panel count is the free variable.
 */
export function fitPvLines(
  rng: Rng,
  business: boolean,
  vip: boolean,
  target: number,
): LineSet {
  const options = drawPv(rng, business, vip);
  let best = pvLines(options, 6);
  for (let count = 7; count <= (business ? 800 : 60); count++) {
    const candidate = pvLines(options, count);
    if (
      Math.abs(linesSubtotal(candidate.lines) - target) <
      Math.abs(linesSubtotal(best.lines) - target)
    ) {
      best = candidate;
    }
  }
  return best;
}

function battery(rng: Rng, vip: boolean): LineSet {
  const lines = [
    line(vip ? "prod-14" : rng.pick(["prod-12", "prod-13"]), 1),
    line(rng.pick(["prod-09", "prod-10"]), 1),
    line("prod-21", rng.int(4, 8)),
  ];
  return { lines, capacityKwp: 0 };
}

function evCharger(rng: Rng, business: boolean): LineSet {
  const lines = business
    ? [line("prod-17", rng.int(2, 8)), line("prod-21", rng.int(6, 16))]
    : [
        line(rng.pick(["prod-15", "prod-16"]), 1),
        line("prod-21", rng.int(2, 5)),
      ];
  return { lines, capacityKwp: 0 };
}

/**
 * The lines of a quote for an installation of the given type, built from the
 * product catalog so they carry the prices of PRODUCT_ROSTER and add up.
 */
export function buildLines(
  rng: Rng,
  type: InstallationType,
  business: boolean,
  vip: boolean,
): LineSet {
  switch (type) {
    case "residential_pv":
    case "commercial_pv": {
      const pvBusiness = type === "commercial_pv";
      return pvLines(
        drawPv(rng, pvBusiness, vip),
        randomCount(rng, pvBusiness, vip),
      );
    }
    case "battery":
      return battery(rng, vip);
    case "ev_charger":
      return evCharger(rng, business);
  }
}

/** Sum of the lines, excluding VAT. */
export function linesSubtotal(lines: readonly QuoteLine[]): number {
  return cents(lines.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
}

/** Subtotal, VAT and total of a set of lines at a VAT rate (0–1). */
export function quoteTotals(lines: readonly QuoteLine[], vatRate: number) {
  const subtotal = linesSubtotal(lines);
  const vatAmount = cents(subtotal * vatRate);
  return { subtotal, vatAmount, total: cents(subtotal + vatAmount) };
}
