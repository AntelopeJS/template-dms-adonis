/**
 * VAT numbers as the EU VIES service writes them: a country prefix and that
 * country's format (Belgium: BE + 10 digits, starting with 0 or 1). It checks the
 * format only: the demo company's own number is fictitious and would fail the
 * Belgian mod-97 check.
 */
const EU_VAT_FORMATS: ReadonlyMap<string, RegExp> = new Map([
  ["AT", /^U\d{8}$/],
  ["BE", /^[01]\d{9}$/],
  ["BG", /^\d{9,10}$/],
  ["CY", /^\d{8}[A-Z]$/],
  ["CZ", /^\d{8,10}$/],
  ["DE", /^\d{9}$/],
  ["DK", /^\d{8}$/],
  ["EE", /^\d{9}$/],
  ["EL", /^\d{9}$/],
  ["ES", /^[A-Z0-9]\d{7}[A-Z0-9]$/],
  ["FI", /^\d{8}$/],
  ["FR", /^[A-HJ-NP-Z0-9]{2}\d{9}$/],
  ["HR", /^\d{11}$/],
  ["HU", /^\d{8}$/],
  ["IE", /^\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/],
  ["IT", /^\d{11}$/],
  ["LT", /^(\d{9}|\d{12})$/],
  ["LU", /^\d{8}$/],
  ["LV", /^\d{11}$/],
  ["MT", /^\d{8}$/],
  ["NL", /^\d{9}B\d{2}$/],
  ["PL", /^\d{10}$/],
  ["PT", /^\d{9}$/],
  ["RO", /^\d{2,10}$/],
  ["SE", /^\d{12}$/],
  ["SI", /^\d{8}$/],
  ["SK", /^\d{10}$/],
]);

/** "be 0123.456.749" → "BE0123456749": spaces, dots and dashes dropped. */
export function normalizeVatNumber(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

/** Whether a (normalized) VAT number has the format of its EU country. */
export function isValidVatNumber(normalized: string): boolean {
  const format = EU_VAT_FORMATS.get(normalized.slice(0, 2));
  return !!format?.test(normalized.slice(2));
}
