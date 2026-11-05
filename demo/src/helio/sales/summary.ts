import type { ComposedText } from "@antelopejs/interface-dms/base/types";
import type { QuoteLine } from "./database";
import { linesSubtotal } from "./lines";

/**
 * The lines the expanded row of a quote shows one by one (the first, with the
 * second under it) before the rest is summed up in one entry.
 */
export const SHOWN_LINES = 2;

function money(amount: number) {
  return {
    type: "money",
    value: Math.round(amount * 100),
    currency: "EUR",
  } as const;
}

/** "12 × Helio Mono 410 W · €2,268.00", or null past the last line. */
export function lineText(
  lines: readonly QuoteLine[] | undefined,
  index: number,
): ComposedText | null {
  const line = lines?.[index];
  return line ? describeLine(line) : null;
}

function describeLine(line: QuoteLine): ComposedText {
  return {
    key: "$helio.sales.quotes.expand.line",
    params: {
      qty: { type: "number", value: line.qty },
      label: line.label,
      amount: money(line.qty * line.unitPrice),
    },
  };
}

/**
 * What follows the lines shown one by one: the next line alone, how many
 * follow and what they add up to, or that there is nothing more. A band of
 * label/value pairs draws a fixed list of fields, so it never returns null.
 */
export function otherLinesText(
  lines: readonly QuoteLine[] | undefined,
): ComposedText {
  const rest = (lines ?? []).slice(SHOWN_LINES);
  const [next] = rest;
  if (!next) return { key: "$helio.sales.quotes.expand.none" };
  if (rest.length === 1) return describeLine(next);
  return {
    key: "$helio.sales.quotes.expand.more",
    params: {
      count: { type: "count", value: rest.length },
      amount: money(linesSubtotal(rest)),
    },
  };
}
