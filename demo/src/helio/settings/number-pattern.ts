const TOKEN = /\{([A-Z]+)(?::(\d+))?\}/g;
const DEFAULT_WIDTH = 4;
const MAX_WIDTH = 10;

type Part =
  | { kind: "text"; value: string }
  | { kind: "date"; token: "YYYY" | "YY" | "MM" }
  | { kind: "seq"; width: number };

const DATE_TOKENS: readonly string[] = ["YYYY", "YY", "MM"];

function isDateToken(token: string): token is "YYYY" | "YY" | "MM" {
  return DATE_TOKENS.includes(token);
}

/**
 * Splits a pattern into text, date and sequence parts. It returns undefined when
 * a token is unknown or the sequence is missing or repeated, or when a brace is
 * left in the text, which is a token typed wrong.
 */
function parse(pattern: string): Part[] | undefined {
  const parts: Part[] = [];
  let index = 0;
  let sequences = 0;
  for (const match of pattern.matchAll(TOKEN)) {
    if (match.index > index)
      parts.push({ kind: "text", value: pattern.slice(index, match.index) });
    index = match.index + match[0].length;
    const [, token = "", width] = match;
    if (token === "SEQ") {
      const digits = width ? Number(width) : DEFAULT_WIDTH;
      if (digits < 1 || digits > MAX_WIDTH) return undefined;
      parts.push({ kind: "seq", width: digits });
      sequences += 1;
    } else if (isDateToken(token) && !width) {
      parts.push({ kind: "date", token });
    } else {
      return undefined;
    }
  }
  if (index < pattern.length)
    parts.push({ kind: "text", value: pattern.slice(index) });
  const stray = parts.some(
    (part) => part.kind === "text" && /[{}]/.test(part.value),
  );
  return sequences === 1 && !stray ? parts : undefined;
}

/** Whether a pattern can number documents: known tokens, one {SEQ}. */
export function isNumberPattern(pattern: string): boolean {
  return parse(pattern) !== undefined;
}

function dateToken(token: "YYYY" | "YY" | "MM", date: Date): string {
  if (token === "YYYY") return String(date.getFullYear());
  if (token === "YY") return String(date.getFullYear() % 100).padStart(2, "0");
  return String(date.getMonth() + 1).padStart(2, "0");
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The number after the highest one of `used` that `pattern` writes for
 * `date`. A pattern of the Settings page (Invoicing › Numbering) is literal text
 * and tokens between braces: {YYYY}, {YY} and {MM} write the issue date and
 * {SEQ:n} the sequence on n digits (4 without a width). The sequence follows on
 * from the highest one already used for the same date tokens, so
 * "F-{YYYY}-{SEQ:4}" starts again at F-2027-0001 on the first invoice of 2027.
 * A pattern that cannot number (see isNumberPattern) falls back to
 * `fallback`, so a document is never left without a number.
 */
export function nextNumber(
  pattern: string,
  date: Date,
  used: Iterable<string>,
  fallback: string,
): string {
  const parts = parse(pattern) ?? parse(fallback);
  if (!parts) throw new Error(`Invalid numbering pattern ${fallback}`);
  const source = parts
    .map((part) => {
      if (part.kind === "text") return escapeRegExp(part.value);
      if (part.kind === "date") return dateToken(part.token, date);
      return "(\\d+)";
    })
    .join("");
  const matcher = new RegExp(`^${source}$`);
  let last = 0;
  for (const number of used) {
    const match = matcher.exec(number ?? "");
    if (match) last = Math.max(last, Number(match[1]));
  }
  return parts
    .map((part) => {
      if (part.kind === "text") return part.value;
      if (part.kind === "date") return dateToken(part.token, date);
      return String(last + 1).padStart(part.width, "0");
    })
    .join("");
}
