import {
  BasicDataModel,
  Field,
  Fixture,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildDefaultSettings } from "./defaults";
import type {
  DateRange,
  ReminderStep,
  ToggleableValue,
  WebhookSubscription,
} from "./types";

const TABLE_NAME = "helio_settings";

/**
 * The company settings of Helio: one document, keyed `HELIO_SETTINGS_ID`.
 * Every value the settings form edits is a top-level field; the structured
 * ones (address, repeaters, key-value pairs, localized texts) are stored as
 * they are submitted.
 */
@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => [buildDefaultSettings()])
export class HelioSettings extends Table {
  @Field("string") declare _id: string;

  @Field("string") declare companyName: string;
  @Field("string") declare legalForm: string;
  @Field("string") declare enterpriseNumber: string;
  @Field("string") declare vatNumber: string;
  @Field("any") declare address: DefaultDataTypes.Address;
  @Field("string") declare phone: string;
  @Field("string") declare email: string;
  @Field("string") declare website: string;
  @Field("string") declare brandColor: string;
  @Field("string") declare logo: string | null;
  @Field("any") declare tagline: Record<string, string>;
  /** `ImageType` and `FileType` values: stored as the upload answers them. */
  @Field("any") declare signature?: unknown;
  @Field("any") declare termsDocument?: unknown;

  @Field("number") declare paymentTermsDays: number;
  @Field("number") declare defaultVatRate: number;
  @Field("number") declare reducedVatRate: number;
  @Field("boolean") declare pricesIncludeVat: boolean;
  @Field("string") declare iban: string;
  @Field("string") declare bic: string;
  @Field("string") declare invoiceNumberPattern: string;
  @Field("string") declare quoteNumberPattern: string;
  @Field("string") declare invoiceFooter: string;
  @Field("number") declare lateInterestRate: number;
  @Field("number") declare recoveryFee: number;
  @Field("any") declare reminders: ReminderStep[];

  @Field("number") declare workdayStart: number;
  @Field("number") declare workdayEnd: number;
  @Field(["string"]) declare workingDays: string[];
  @Field("number") declare slaUrgentHours: number;
  @Field("number") declare slaHighHours: number;
  @Field("number") declare slaNormalHours: number;
  @Field("number") declare slaLowHours: number;
  @Field("any") declare winterClosure: DateRange;
  @Field("any") declare bridgeDays: Date[];
  @Field("string") declare defaultTechnician: string | null;
  @Field(["string"]) declare interventionZones: string[];
  @Field("number") declare travelRadiusKm: number;

  @Field("string") declare apiKey: string;
  @Field("string") declare monitoringEndpoint: string;
  @Field("any") declare webhooks: WebhookSubscription[];
  @Field("any") declare webhookHeaders: Record<string, ToggleableValue>;
  @Field("string") declare alertPayloadTemplate: string;
  @Field("string") declare smtpHost: string;
  @Field("number") declare smtpPort: number;
  @Field("string") declare smtpUser: string;
  /** Write-only: never served back to the form. */
  @Field("string") declare smtpPassword: string | null;
  @Field("string") declare accountingSoftware: string;

  @Field(["string"]) declare alertChannels: string[];
  @Field("string") declare digestFrequency: string;
  @Field("boolean") declare notifyUrgentTickets: boolean;
  @Field("boolean") declare notifyOfflineSites: boolean;
  @Field("boolean") declare notifyOverdueInvoices: boolean;
  @Field(["string"]) declare alertRecipients: string[];
}

export class HelioSettingsModel extends BasicDataModel(
  HelioSettings,
  TABLE_NAME,
) {}
