import { GetModel } from "@antelopejs/interface-database-decorators";
import { currentSettings } from "../settings/current";
import { nextNumber } from "../settings/number-pattern";
import { QuoteModel } from "./database";

/** The pattern a quote is numbered with when the Settings page has none usable. */
const DEFAULT_PATTERN = "Q-{YYYY}-{SEQ:4}";

/**
 * The quote pattern of the Settings page, as read by the last
 * `loadQuoteNumbers`. Undefined until then.
 */
let pattern: string | undefined;

/** The quote numbers already taken: read from the database, then handed out. */
const used = new Set<string>();

/**
 * Reads the quote pattern and the numbers already used. The data API writes a
 * new row synchronously (setters cannot await), so the quotes table's `new`
 * guard runs this before every creation: a pattern changed on the Settings page
 * applies to the next quote, and a number taken since the read stays known.
 */
export async function loadQuoteNumbers(): Promise<void> {
  const [settings, quotes] = await Promise.all([
    currentSettings(),
    GetModel(QuoteModel).getAll(),
  ]);
  pattern = settings.quoteNumberPattern;
  for (const { number } of quotes) if (number) used.add(number);
}

/**
 * Takes the next number the pattern gives on `issuedAt`, following on from the
 * last number used. Throws when `loadQuoteNumbers` did not run first, as the
 * number could then repeat one already used.
 */
export function takeQuoteNumber(issuedAt: Date): string {
  if (pattern === undefined) {
    throw new Error("Quote numbers were not loaded before the creation");
  }
  const number = nextNumber(pattern, issuedAt, used, DEFAULT_PATTERN);
  used.add(number);
  return number;
}
