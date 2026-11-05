import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";

/** The id of the one settings document. */
export const HELIO_SETTINGS_ID = "company";

/** One step of the payment reminder schedule (an `ArrayType` row). */
export interface ReminderStep {
  afterDays: number;
  channel: string;
  template: string;
}

/** One outgoing webhook (an `ArrayType` row). */
export interface WebhookSubscription {
  event: string;
  url: string;
  active: boolean;
}

/** A header of a toggleable `KeyValueType`. */
export interface ToggleableValue {
  value: string;
  enabled: boolean;
}

/** A `DateType({ range: true })` value. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Identity and branding of the company. */
export interface CompanySettings {
  companyName: string;
  legalForm: string;
  enterpriseNumber: string;
  vatNumber: string;
  address: DefaultDataTypes.Address;
  phone: string;
  email: string;
  website: string;
  brandColor: string;
  logo: string | null;
  tagline: Record<string, string>;
}

/** Invoices, quotes and the collection of unpaid invoices. */
export interface InvoicingSettings {
  paymentTermsDays: number;
  defaultVatRate: number;
  reducedVatRate: number;
  pricesIncludeVat: boolean;
  iban: string;
  bic: string;
  invoiceNumberPattern: string;
  quoteNumberPattern: string;
  invoiceFooter: string;
  lateInterestRate: number;
  recoveryFee: number;
  reminders: ReminderStep[];
}

/** Working hours, service levels and field work. */
export interface OperationsSettings {
  workdayStart: number;
  workdayEnd: number;
  workingDays: string[];
  slaUrgentHours: number;
  slaHighHours: number;
  slaNormalHours: number;
  slaLowHours: number;
  winterClosure: DateRange;
  bridgeDays: Date[];
  defaultTechnician: string | null;
  interventionZones: string[];
  travelRadiusKm: number;
}

/** API access, webhooks, e-mail delivery and accounting. */
export interface IntegrationSettings {
  apiKey: string;
  monitoringEndpoint: string;
  webhooks: WebhookSubscription[];
  webhookHeaders: Record<string, ToggleableValue>;
  alertPayloadTemplate: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string | null;
  accountingSoftware: string;
}

/** Who is alerted, how, and about what (the instant-save form). */
export interface NotificationSettings {
  alertChannels: string[];
  digestFrequency: string;
  notifyUrgentTickets: boolean;
  notifyOfflineSites: boolean;
  notifyOverdueInvoices: boolean;
  alertRecipients: string[];
}

/** Every value of the settings document, as the fixture seeds it. */
export interface HelioSettingsValues
  extends
    CompanySettings,
    InvoicingSettings,
    OperationsSettings,
    IntegrationSettings,
    NotificationSettings {
  _id: string;
}
