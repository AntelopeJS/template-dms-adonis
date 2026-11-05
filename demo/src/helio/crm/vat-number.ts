const BELGIAN = /^BE[01]\d{9}$/;
const OTHER_EU =
  /^(AT|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK|XI)[0-9A-Z]{8,12}$/;

function normalize(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

function hasBelgianCheckDigits(number: string): boolean {
  const base = Number(number.slice(2, 10));
  const check = Number(number.slice(10));
  return 97 - (base % 97) === check;
}

/**
 * Whether `value` is a valid Belgian or a well-formed EU VAT number. A Belgian
 * number is BE, then 0 or 1 and nine digits whose last two are 97 − (the first
 * eight mod 97); a number of another EU country only has to look like one (its
 * prefix, then 8 to 12 digits or letters). Spaces, dots and dashes are ignored.
 */
export function isValidVatNumber(value: string): boolean {
  const number = normalize(value);
  if (number.startsWith("BE")) {
    return BELGIAN.test(number) && hasBelgianCheckDigits(number);
  }
  return OTHER_EU.test(number);
}
