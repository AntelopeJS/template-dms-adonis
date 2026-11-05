import { Schema } from "@antelopejs/interface-database";
import {
  DEFAULT_TENANT_ID,
  TENANT_SCHEMA_NAME,
} from "@antelopejs/interface-dms/constants";
import { helioSecret } from "../../shared/clock";
import { isObject } from "../../shared/json";

const MAILING_SETTINGS_TABLE = "mailing_settings";
const WEBHOOK_SECRET_BYTES = 24;

/** Thrown when the Mailing module's settings are not where `pinWebhookSecret` expects them, so the secret would stay random. */
export class WebhookSecretPinError extends Error {
  constructor(reason: string) {
    super(
      `cannot pin the Mailing webhook secret: ${reason}. The Mailing module's settings table or field changed.`,
    );
    this.name = "WebhookSecretPinError";
  }
}

function hasWebhookSecret(row: unknown): row is { webhookSecret: string } {
  return (
    isObject(row) &&
    "webhookSecret" in row &&
    typeof row.webhookSecret === "string"
  );
}

/**
 * Throws a {@link WebhookSecretPinError} unless `row` is the Mailing settings row with a string `webhookSecret`.
 *
 * @param row What the settings table answered for the default workspace
 */
export function requireWebhookSecretRow(
  row: unknown,
): asserts row is { webhookSecret: string } {
  if (row === null || row === undefined)
    throw new WebhookSecretPinError(
      `table "${MAILING_SETTINGS_TABLE}" has no row for the default workspace`,
    );
  if (!hasWebhookSecret(row))
    throw new WebhookSecretPinError(
      `the "${MAILING_SETTINGS_TABLE}" row has no string "webhookSecret"`,
    );
}

/** The query on the Mailing settings row of the default workspace: the part of the database `pinSettingsRow` uses. */
export interface SettingsRowQuery {
  run(): Promise<StoredSettings>;
  update(changes: { webhookSecret: string }): { run(): Promise<number> };
}

/** What the settings table answers for the default workspace: the stored fields, or nothing. */
export type StoredSettings = object | null | undefined;

/**
 * Reads the settings row, requires a string `webhookSecret` in it, then writes
 * the derived secret once. It does not check the count the write answers
 * (mongodb answers 0 when a restart writes the same value).
 *
 * @param row The query on the Mailing settings row
 * @throws {WebhookSecretPinError} When the row or its string `webhookSecret` is missing; nothing is written then
 */
export async function pinSettingsRow(row: SettingsRowQuery): Promise<void> {
  const found: unknown = await row.run();
  requireWebhookSecretRow(found);
  await row
    .update({
      webhookSecret: helioSecret("mailing-webhook", WEBHOOK_SECRET_BYTES),
    })
    .run();
}

/**
 * Replaces the webhook secret the Mailing module generated for the default
 * workspace with one derived from `HELIO_NOW`, so the settings page shows the
 * same last characters on every run. The module has no interface to set it,
 * so this reads its settings row, which the module has created by then (the
 * category declaration saves it), and writes the field. Without `HELIO_NOW`
 * the module's random secret stays.
 *
 * @throws {WebhookSecretPinError} Under `HELIO_NOW`, when the schema, the row or its string `webhookSecret` is missing
 */
export async function pinWebhookSecret(): Promise<void> {
  if (!process.env.HELIO_NOW) return;
  const schema = Schema.get(TENANT_SCHEMA_NAME);
  if (!schema)
    throw new WebhookSecretPinError(
      `schema "${TENANT_SCHEMA_NAME}" is not defined`,
    );
  await pinSettingsRow(
    schema
      .instance(DEFAULT_TENANT_ID)
      .table(MAILING_SETTINGS_TABLE)
      .get(DEFAULT_TENANT_ID),
  );
}
