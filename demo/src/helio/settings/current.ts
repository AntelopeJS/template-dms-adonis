import { GetModel } from "@antelopejs/interface-database-decorators";
import { HelioSettingsModel } from "./database";
import { buildDefaultSettings } from "./defaults";
import { HELIO_SETTINGS_ID, type HelioSettingsValues } from "./types";

/**
 * The settings as saved on the Settings page, for the code that applies them
 * (numbering, documents, defaults of new records); the defaults until the
 * document is written.
 */
export async function currentSettings(): Promise<HelioSettingsValues> {
  const stored = await GetModel(HelioSettingsModel).get(HELIO_SETTINGS_ID);
  return stored ?? buildDefaultSettings();
}
