import { helioNow } from "./clock";
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both included. */
  int(min: number, max: number): number;
  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** One element, chosen with the given relative weights. */
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
}

/**
 * A seeded mulberry32 generator, tiny, fast and good enough for demo data. Every
 * Helio fixture draws from one, so a fresh database always holds the same demo data.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const at = <T>(items: readonly T[], index: number): T => {
    const item = items[index];
    if (item === undefined) throw new Error("Cannot draw from an empty list");
    return item;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => at(items, Math.floor(next() * items.length)),
    weighted: (items) => {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [item, weight] of items) {
        roll -= weight;
        if (roll < 0) return item;
      }
      return at(items, items.length - 1)[0];
    },
    chance: (probability) => next() < probability,
  };
}

/**
 * A date `days` days from now (negative for the past), at a given hour. Fixture
 * dates are built relative to now so the dashboard always looks current.
 */
export function daysFromNow(days: number, hour = 10): Date {
  const date = new Date(helioNow() + days * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Rounds an amount to the cent. */
export function cents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Zero-padded id: `padId("cust", 7, 3)` → `cust-007`. */
export function padId(prefix: string, index: number, width: number): string {
  return `${prefix}-${String(index).padStart(width, "0")}`;
}
