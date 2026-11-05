import { createHash, randomBytes } from "node:crypto";
import { SLA_HOURS } from "../service/options";
import { daysFromNow } from "../shared/seed";
import {
  type CompanySettings,
  type DateRange,
  HELIO_SETTINGS_ID,
  type HelioSettingsValues,
  type IntegrationSettings,
  type InvoicingSettings,
  type NotificationSettings,
  type OperationsSettings,
} from "./types";
import { helioNow } from "../shared/clock";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const API_KEY_BYTES = 20;

/** Module defaults the form offers back with "Use default". */
export const DEFAULT_BRAND_COLOR = "#F59E0B";
export const DEFAULT_PAYMENT_TERMS_DAYS = 30;
export const DEFAULT_TRAVEL_RADIUS_KM = 60;
export const DEFAULT_INVOICE_PATTERN = "F-{YYYY}-{SEQ:4}";

/** A new live API key, as the rotate route hands it out. */
export function generateApiKey(): string {
  return `hk_live_${randomBytes(API_KEY_BYTES).toString("hex")}`;
}

/** The key the seed writes: derived from `HELIO_NOW` when it is set, so two runs on an empty database write the same one. */
function seededApiKey(): string {
  const fixed = process.env.HELIO_NOW;
  if (!fixed) return generateApiKey();
  const digest = createHash("sha256").update(`helio-api-key:${fixed}`);
  return `hk_live_${digest.digest("hex").slice(0, API_KEY_BYTES * 2)}`;
}

const IBAN = "BE71 0961 2345 6769";
const BIC = "GEBABEBB";

/**
 * The default invoice footer, written from the company defaults so it names the
 * same address, VAT number and account as the rest of the settings. It is in
 * French, the language Helio invoices its Walloon customers in. The late-payment
 * terms are not repeated: the document writes them from the collection settings.
 */
function invoiceFooter(company: CompanySettings): string {
  const { address } = company;
  return [
    `<p><strong>${company.companyName}</strong> · ${address.streetName} ${address.houseNumber}, ${address.postalCode} ${address.city} · TVA BE${company.enterpriseNumber}</p>`,
    `<p>Payable à ${DEFAULT_PAYMENT_TERMS_DAYS} jours par virement sur le compte ${IBAN} (${BIC}), en mentionnant le numéro de facture.</p>`,
  ].join("");
}

const ALERT_PAYLOAD_TEMPLATE = `{
  "text": "Helio alert: {{alert.kind}} on {{site.name}} ({{site.city}})",
  "customer": "{{customer.name}}",
  "raisedAt": "{{alert.at}}",
  "source": "helio-monitoring"
}`;

/**
 * The calendar day of `date` at UTC midnight, the way the form's date picker
 * stores a day. A day stamped at local midnight (23:00 UTC the day before in
 * Brussels) would show one day early.
 */
export function pickerDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * The winter closure, from the next 24 December to 2 January, so the seed stays
 * in the future whatever day the demo is installed.
 */
function nextWinterClosure(): DateRange {
  const now = new Date(helioNow());
  let year = now.getFullYear();
  if (pickerDay(now).getTime() > Date.UTC(year, 11, 24)) year += 1;
  return {
    start: new Date(Date.UTC(year, 11, 24)),
    end: new Date(Date.UTC(year + 1, 0, 2)),
  };
}

/** The company defaults. The brand colour differs from the module default so the field offers "Use default". */
function companyDefaults(): CompanySettings {
  return {
    companyName: "Helio SRL",
    legalForm: "srl",
    enterpriseNumber: "0742.318.065",
    vatNumber: "BE0742318065",
    address: {
      streetName: "Rue de l'Énergie",
      houseNumber: "12",
      postalCode: "4040",
      city: "Herstal",
      countrySubdivision: "Liège",
      countryCode: "BE",
    },
    phone: "+3242205050",
    email: "contact@helio.example",
    website: "https://helio.example",
    brandColor: "#EA580C",
    logo: null,
    tagline: {
      en: "Solar energy, installed and looked after by your neighbours.",
      fr: "L'énergie solaire, installée et suivie par vos voisins.",
    },
  };
}

function invoicingDefaults(): InvoicingSettings {
  return {
    paymentTermsDays: DEFAULT_PAYMENT_TERMS_DAYS,
    defaultVatRate: 0.21,
    reducedVatRate: 0.06,
    pricesIncludeVat: true,
    iban: IBAN,
    bic: BIC,
    invoiceNumberPattern: DEFAULT_INVOICE_PATTERN,
    quoteNumberPattern: "Q-{YYYY}-{SEQ:4}",
    invoiceFooter: invoiceFooter(companyDefaults()),
    lateInterestRate: 0.1,
    recoveryFee: 40,
    reminders: [
      { afterDays: 7, channel: "email", template: "friendly" },
      { afterDays: 21, channel: "email", template: "firm" },
      { afterDays: 45, channel: "registered_mail", template: "formal_notice" },
    ],
  };
}

/**
 * The operations defaults. The SLA hours are the promises the service desk
 * computes its SLAs with, and the bridge days (jours de pont) are days the crews
 * take off, spread over the season.
 */
function operationsDefaults(): OperationsSettings {
  return {
    workdayStart: 7 * HOUR_MS + 30 * MINUTE_MS,
    workdayEnd: 17 * HOUR_MS,
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
    slaUrgentHours: SLA_HOURS.urgent,
    slaHighHours: SLA_HOURS.high,
    slaNormalHours: SLA_HOURS.normal,
    slaLowHours: SLA_HOURS.low,
    winterClosure: nextWinterClosure(),
    bridgeDays: [23, 60, 97].map((days) => pickerDay(daysFromNow(days))),
    defaultTechnician: "team-05",
    interventionZones: ["Liège", "Namur", "Bruxelles", "Hainaut", "Luxembourg"],
    travelRadiusKm: 80,
  };
}

function integrationDefaults(): IntegrationSettings {
  return {
    apiKey: seededApiKey(),
    monitoringEndpoint:
      "https://api.helio.example/hooks/monitoring/7c1e4b9a2f5d4e08",
    webhooks: [
      {
        event: "ticket.created",
        url: "https://hooks.helio.example/teams/service-desk",
        active: true,
      },
      {
        event: "invoice.paid",
        url: "https://erp.helio.example/webhooks/invoices",
        active: true,
      },
      {
        event: "site.offline",
        url: "https://hooks.helio.example/teams/monitoring",
        active: false,
      },
    ],
    webhookHeaders: {
      "X-Helio-Source": { value: "dms", enabled: true },
      "X-Helio-Region": { value: "be-wallonia", enabled: false },
    },
    alertPayloadTemplate: ALERT_PAYLOAD_TEMPLATE,
    smtpHost: "smtp.helio.example",
    smtpPort: 587,
    smtpUser: "notifications@helio.example",
    smtpPassword: null,
    accountingSoftware: "winbooks",
  };
}

function notificationDefaults(): NotificationSettings {
  return {
    alertChannels: ["email", "teams"],
    digestFrequency: "daily",
    notifyUrgentTickets: true,
    notifyOfflineSites: true,
    notifyOverdueInvoices: false,
    alertRecipients: [
      "sophie.lambert@helio.example",
      "nadia.haddad@helio.example",
    ],
  };
}

/** The settings document Helio starts with, and the one a reset restores. */
export function buildDefaultSettings(): HelioSettingsValues {
  return {
    _id: HELIO_SETTINGS_ID,
    ...companyDefaults(),
    ...invoicingDefaults(),
    ...operationsDefaults(),
    ...integrationDefaults(),
    ...notificationDefaults(),
  };
}
