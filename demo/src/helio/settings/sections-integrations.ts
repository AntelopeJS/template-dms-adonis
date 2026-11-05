import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import type { FormSection } from "@antelopejs/interface-dms/base/form";
import {
  ACCOUNTING_SOFTWARE,
  PAYLOAD_COMPLETIONS,
  WEBHOOK_EVENTS,
} from "./options";
import { SETTINGS_ROTATE_URL } from "./paths";

const NAV_GROUP = "$helio.settings.groups.integrations";
const MAX_WEBHOOKS = 10;

/**
 * The API fields. The API key is written only by the rotate route: the save
 * route ignores it.
 */
const apiSection: FormSection = {
  id: "api",
  label: "$helio.settings.sections.api",
  description: "$helio.settings.sections.api_description",
  icon: "i-ph-plugs-connected",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "apiKey",
      label: "$helio.settings.fields.apiKey",
      description: "$helio.settings.descriptions.apiKey",
      type: new DefaultDataTypes.SecretType({ rotateUrl: SETTINGS_ROTATE_URL }),
    },
    {
      id: "monitoringEndpoint",
      label: "$helio.settings.fields.monitoringEndpoint",
      description: "$helio.settings.descriptions.monitoringEndpoint",
      type: new DefaultDataTypes.StringType({ copyable: true }),
    },
    {
      id: "webhooks",
      label: "$helio.settings.fields.webhooks",
      description: "$helio.settings.descriptions.webhooks",
      type: new DefaultDataTypes.ArrayType({
        of: {
          event: {
            type: new DefaultDataTypes.SelectType({ items: WEBHOOK_EVENTS }),
            label: "$helio.settings.fields.webhookEvent",
            required: true,
          },
          url: {
            type: new DefaultDataTypes.UrlType({ placeholder: "https://" }),
            label: "$helio.settings.fields.webhookUrl",
            required: true,
          },
          active: {
            type: new DefaultDataTypes.BooleanType(),
            label: "$helio.settings.fields.webhookActive",
          },
        },
        max: MAX_WEBHOOKS,
        addLabel: "$helio.settings.actions.addWebhook",
      }),
    },
    {
      id: "webhookHeaders",
      label: "$helio.settings.fields.webhookHeaders",
      description: "$helio.settings.descriptions.webhookHeaders",
      type: new DefaultDataTypes.KeyValueType({
        toggleable: true,
        keyLabel: "$helio.settings.fields.headerName",
        valueLabel: "$helio.settings.fields.headerValue",
        addLabel: "$helio.settings.actions.addHeader",
      }),
    },
    {
      id: "alertPayloadTemplate",
      label: "$helio.settings.fields.alertPayloadTemplate",
      description: "$helio.settings.descriptions.alertPayloadTemplate",
      type: new DefaultDataTypes.CodeType({
        language: "json",
        minLines: 6,
        maxLines: 14,
        completions: PAYLOAD_COMPLETIONS,
      }),
      hint: "$helio.settings.hints.alertPayloadTemplate",
    },
  ],
};

/**
 * The outgoing e-mail fields. The SMTP password is write-only: the GET route
 * never serves it, so the field starts empty.
 */
const emailSection: FormSection = {
  id: "email",
  label: "$helio.settings.sections.email",
  description: "$helio.settings.sections.email_description",
  icon: "i-ph-paper-plane-tilt",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "smtpServer",
      label: "$helio.settings.fields.smtpServer",
      orientation: "horizontal",
      fields: [
        {
          id: "smtpHost",
          label: "$helio.settings.fields.smtpHost",
          type: new DefaultDataTypes.StringType({
            placeholder: "smtp.example.com",
          }),
          required: true,
        },
        {
          id: "smtpPort",
          label: "$helio.settings.fields.smtpPort",
          type: new DefaultDataTypes.NumberType({ min: 1, max: 65535 }),
          required: true,
        },
      ],
    },
    {
      id: "smtpUser",
      label: "$helio.settings.fields.smtpUser",
      type: new DefaultDataTypes.EmailType(),
      required: true,
    },
    {
      id: "smtpPassword",
      label: "$helio.settings.fields.smtpPassword",
      type: new DefaultDataTypes.PasswordType({ minLength: 8 }),
      hint: "$helio.settings.hints.smtpPassword",
    },
  ],
};

const accountingSection: FormSection = {
  id: "accounting",
  label: "$helio.settings.sections.accounting",
  description: "$helio.settings.sections.accounting_description",
  icon: "i-ph-calculator",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "accountingSoftware",
      label: "$helio.settings.fields.accountingSoftware",
      type: new DefaultDataTypes.SelectType({
        items: ACCOUNTING_SOFTWARE,
        display: "radio",
      }),
      required: true,
    },
  ],
};

/** The Integrations part of the settings form. */
export const integrationSections: FormSection[] = [
  apiSection,
  emailSection,
  accountingSection,
];
