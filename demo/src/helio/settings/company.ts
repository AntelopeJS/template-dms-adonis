import { GetModel } from "@antelopejs/interface-database-decorators";
import { HelioSettingsModel } from "./database";
import { buildDefaultSettings } from "./defaults";
import {
  type CompanySettings,
  HELIO_SETTINGS_ID,
  type InvoicingSettings,
} from "./types";

/**
 * The issuer block of a document, as printed (quotes, invoices, e-mails). It is
 * read from the company settings, the one source of truth, so a change on the
 * Settings page shows on the next quote or invoice. The defaults (defaults.ts)
 * are the fictional company the demo starts with.
 */
export interface CompanyIdentity {
  name: string;
  /** "Rue de l'Énergie 12" */
  street: string;
  /** "4040 Herstal" */
  city: string;
  country: string;
  /** "BE 0742.318.065" */
  vatNumber: string;
  /** "+32 4 220 50 50" */
  phone: string;
  email: string;
  /** "helio.example", without the scheme. */
  website: string;
  iban: string;
  bic: string;
  /** "#EA580C": headings and accents of the documents. */
  brandColor: string;
  /** The tagline in each language ("en", "fr"). */
  tagline: Record<string, string>;
}

type IdentitySource = Pick<
  CompanySettings,
  | "companyName"
  | "vatNumber"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "brandColor"
  | "tagline"
> &
  Pick<InvoicingSettings, "iban" | "bic">;

/** Formats a VAT number the way Belgian documents write it: BE0742318065 → BE 0742.318.065. */
function formatVat(vat: string): string {
  const digits = vat.replace(/\D/g, "");
  if (!vat.toUpperCase().startsWith("BE") || digits.length !== 10) return vat;
  return `BE ${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
}

/** Spaces a Belgian landline with a one-digit area code: +3242205050 → +32 4 220 50 50 (Liège). */
function formatPhone(phone: string): string {
  const match = /^\+32(\d)(\d{3})(\d{2})(\d{2})$/.exec(
    phone.replace(/\s/g, ""),
  );
  return match ? `+32 ${match.slice(1).join(" ")}` : phone;
}

/** The printed identity of a settings document. */
export function companyIdentity(source: IdentitySource): CompanyIdentity {
  const { address } = source;
  return {
    name: source.companyName,
    street: [address.streetName, address.houseNumber, address.boxNumber]
      .filter(Boolean)
      .join(" "),
    city: `${address.postalCode} ${address.city}`,
    country: address.countryCode === "BE" ? "Belgique" : address.countryCode,
    vatNumber: formatVat(source.vatNumber),
    phone: formatPhone(source.phone),
    email: source.email,
    website: source.website.replace(/^https?:\/\//, ""),
    iban: source.iban,
    bic: source.bic,
    brandColor: source.brandColor,
    tagline: source.tagline ?? {},
  };
}

/** The identity the demo starts with (the settings defaults). */
export const DEFAULT_COMPANY: CompanyIdentity = companyIdentity(
  buildDefaultSettings(),
);

/** The identity as currently saved on the Settings page. */
export async function readCompanyIdentity(): Promise<CompanyIdentity> {
  const stored = await GetModel(HelioSettingsModel).get(HELIO_SETTINGS_ID);
  return stored ? companyIdentity(stored) : DEFAULT_COMPANY;
}
