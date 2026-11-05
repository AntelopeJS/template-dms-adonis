import type { Customer } from "../../crm/database";

/**
 * The template locales Helio ships: French first, English for a few
 * businesses. The Mailing module interpolates variables as plain text, so
 * this module formats every value once, for the recipient's locale.
 */
export type MailLocale = "fr" | "en";

const INTL_LOCALE: Record<MailLocale, string> = { fr: "fr-BE", en: "en-GB" };
const TIME_ZONE = "Europe/Brussels";

/** Where customers follow their quotes, invoices and tickets (fictional). */
export const HELIO_PORTAL_URL = "https://portail.helio.example";

/** The Mailing workspace category every Helio template belongs to. */
export const HELIO_MAIL_CATEGORY = "helio";

/** Template slugs: fixed once created, the code sends by them. */
export const HELIO_TEMPLATES = {
  quoteSent: "helio-quote-sent",
  quoteAccepted: "helio-quote-accepted",
  installationScheduled: "helio-installation-scheduled",
  invoiceIssued: "helio-invoice-issued",
  invoiceReminder: "helio-invoice-reminder",
  ticketReceived: "helio-ticket-received",
  ticketResolved: "helio-ticket-resolved",
} as const;

export type HelioTemplateSlug =
  (typeof HELIO_TEMPLATES)[keyof typeof HELIO_TEMPLATES];

/**
 * The language a customer is written to. Helio works in Wallonia, so French
 * by default; the businesses of the Brussels region asked for English.
 */
export function customerLocale(
  customer: Pick<Customer, "kind" | "address">,
): MailLocale {
  const region = customer.address?.countrySubdivision ?? "";
  return customer.kind === "business" && region.startsWith("Brussels")
    ? "en"
    : "fr";
}

/** "1 234,56 €" in French, "€1,234.56" in English. */
export function formatMoney(amount: number, locale: MailLocale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** "mardi 21 octobre 2026" / "Tuesday 21 October 2026". */
export function formatDate(date: Date, locale: MailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** A date with its time, for a response deadline: "21 octobre à 14:00". */
export function formatDateTime(date: Date, locale: MailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** A postal address on one line: "Rue de la Gare 12, 4000 Liège". */
export function formatAddress(
  address: Customer["address"] | undefined,
): string {
  if (!address) return "";
  const street = [address.streetName, address.houseNumber]
    .filter(Boolean)
    .join(" ");
  const city = [address.postalCode, address.city].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ");
}

/** The portal page of an invoice or a ticket, by its public number. */
export function portalUrl(kind: "factures" | "tickets", number: string) {
  return `${HELIO_PORTAL_URL}/${kind}/${encodeURIComponent(number)}`;
}
