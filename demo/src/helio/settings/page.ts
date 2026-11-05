import { Get, JSONBody, Post, Put } from "@antelopejs/interface-api";
import type { User } from "@antelopejs/interface-dms/auth/db";
import type { BannerContent } from "@antelopejs/interface-dms/base/banner";
import { Banner } from "@antelopejs/interface-dms/base/banner";
import { Form } from "@antelopejs/interface-dms/base/form";
import { FormPageLayout } from "@antelopejs/interface-dms/base/layouts";
import { Section } from "@antelopejs/interface-dms/base/section";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { helioCategory } from "../category";
import type { JsonObject } from "../shared/json";
import { notificationsSection } from "./notifications";
import {
  SETTINGS_DANGER_URL,
  SETTINGS_RESET_URL,
  SETTINGS_VALUES_URL,
} from "./paths";
import { companySections } from "./sections-company";
import { financeSections } from "./sections-finance";
import { integrationSections } from "./sections-integrations";
import { operationsSections } from "./sections-operations";
import {
  readCompanyName,
  readSettings,
  resetSettings,
  rotateApiKey,
  saveSettings,
  type SettingsFormValues,
} from "./store";

/**
 * The company settings of Helio: one sectioned form saved through the save
 * bar (notifications included), and a danger zone. The form reads and writes
 * the one settings document.
 */
@RegisterPage()
export class PageHelioSettings extends PageController(
  "settings",
  {
    displayName: "$helio.settings.title",
    description: "$helio.settings.description",
    icon: "i-ph-gear-six",
    category: helioCategory,
    order: 5,
  },
  FormPageLayout(),
) {
  static form = Form({
    fetchUrl: SETTINGS_VALUES_URL,
    submitUrl: SETTINGS_VALUES_URL,
    sectionNav: "side",
    successMessage: "$helio.settings.saved",
    errorMessage: "$helio.settings.saveFailed",
    sections: [
      ...companySections(PageHelioSettings),
      ...financeSections,
      ...operationsSections,
      notificationsSection,
      ...integrationSections,
    ],
  });

  static dangerZone = Section({
    title: "$helio.settings.danger.title",
    description: "$helio.settings.danger.description",
    danger: true,
  }).child("reset", Banner({ fetchUrl: SETTINGS_DANGER_URL }));

  @AuthUserWithPermission(PageHelioSettings)
  declare user: User;

  @Get("/values")
  getValues(): Promise<SettingsFormValues> {
    return readSettings();
  }

  /** A partial save of the form: absent keys stay as they are. */
  @Put("/values")
  putValues(@JSONBody() body: JsonObject): Promise<SettingsFormValues> {
    return saveSettings(body, PageHelioSettings.form.fields);
  }

  @Post("/api-key/rotate")
  rotateKey(): Promise<{ value: string }> {
    return rotateApiKey();
  }

  /**
   * The danger zone's banner, worded by the server so the confirmation asks
   * for the company name as it is stored right now.
   */
  @Get("/danger-zone")
  async dangerZoneContent(): Promise<BannerContent> {
    const companyName = await readCompanyName();
    return {
      tone: "error",
      size: "sm",
      icon: "i-ph-arrow-counter-clockwise",
      title: "$helio.settings.danger.reset_title",
      description: "$helio.settings.danger.reset_description",
      actions: [
        {
          label: "$helio.settings.danger.reset_action",
          icon: "i-ph-arrow-counter-clockwise",
          color: "error",
          target: {
            type: "api",
            url: SETTINGS_RESET_URL,
            method: "POST",
            successMessage: "$helio.settings.danger.reset_done",
          },
          confirm: {
            title: "$helio.settings.danger.confirm_title",
            description: "$helio.settings.danger.confirm_description",
            icon: "i-ph-warning",
            color: "error",
            confirmLabel: "$helio.settings.danger.reset_action",
            confirmText: companyName,
            confirmTextCaseInsensitive: true,
            impact: [
              {
                icon: "i-ph-receipt",
                label: "$helio.settings.danger.impact_invoicing",
              },
              {
                icon: "i-ph-clock",
                label: "$helio.settings.danger.impact_operations",
              },
              {
                icon: "i-ph-bell",
                label: "$helio.settings.danger.impact_notifications",
              },
              {
                icon: "i-ph-key",
                label: "$helio.settings.danger.impact_credentials",
              },
            ],
          },
        },
      ],
    };
  }

  @Post("/reset")
  reset(): Promise<{ ok: true }> {
    return resetSettings();
  }
}
