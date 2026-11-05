import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import type { FormSection } from "@antelopejs/interface-dms/base/form";
import {
  DEFAULT_INVOICE_PATTERN,
  DEFAULT_PAYMENT_TERMS_DAYS,
} from "./defaults";
import { REMINDER_CHANNELS, REMINDER_TEMPLATES } from "./options";

const NAV_GROUP = "$helio.settings.groups.finance";
const MAX_REMINDERS = 5;
/** The highest Belgian VAT rate: no default rate can go above it. */
const MAX_VAT_RATE = 0.21;

const invoicingSection: FormSection = {
  id: "invoicing",
  label: "$helio.settings.sections.invoicing",
  description: "$helio.settings.sections.invoicing_description",
  icon: "i-ph-receipt",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "paymentTermsDays",
      label: "$helio.settings.fields.paymentTermsDays",
      type: new DefaultDataTypes.NumberType({
        min: 0,
        max: 90,
        step: 1,
        suffix: "$helio.settings.units.days",
      }),
      defaultValue: DEFAULT_PAYMENT_TERMS_DAYS,
      hint: "$helio.settings.hints.paymentTermsDays",
      required: true,
    },
    {
      id: "vatRates",
      label: "$helio.settings.fields.vatRates",
      description: "$helio.settings.descriptions.vatRates",
      orientation: "horizontal",
      fields: [
        {
          id: "defaultVatRate",
          label: "$helio.settings.fields.defaultVatRate",
          type: new DefaultDataTypes.PercentageType({ max: MAX_VAT_RATE }),
          required: true,
        },
        {
          id: "reducedVatRate",
          label: "$helio.settings.fields.reducedVatRate",
          type: new DefaultDataTypes.PercentageType({ max: MAX_VAT_RATE }),
          required: true,
        },
      ],
    },
    {
      id: "pricesIncludeVat",
      label: "$helio.settings.fields.pricesIncludeVat",
      type: new DefaultDataTypes.BooleanType({
        display: "checkbox",
        label: "$helio.settings.fields.pricesIncludeVat_label",
        description: "$helio.settings.descriptions.pricesIncludeVat",
      }),
    },
    {
      id: "bank",
      label: "$helio.settings.fields.bank",
      orientation: "horizontal",
      fields: [
        {
          id: "iban",
          label: "$helio.settings.fields.iban",
          type: new DefaultDataTypes.StringType({
            placeholder: "BE00 0000 0000 0000",
            maxLength: 34,
          }),
          required: true,
        },
        {
          id: "bic",
          label: "$helio.settings.fields.bic",
          type: new DefaultDataTypes.StringType({ maxLength: 11 }),
        },
      ],
    },
    {
      id: "numbering",
      label: "$helio.settings.fields.numbering",
      orientation: "horizontal",
      fields: [
        {
          id: "invoiceNumberPattern",
          label: "$helio.settings.fields.invoiceNumberPattern",
          type: new DefaultDataTypes.StringType({ maxLength: 40 }),
          defaultValue: DEFAULT_INVOICE_PATTERN,
          hint: "$helio.settings.hints.numberPattern",
          required: true,
        },
        {
          id: "quoteNumberPattern",
          label: "$helio.settings.fields.quoteNumberPattern",
          type: new DefaultDataTypes.StringType({ maxLength: 40 }),
          required: true,
        },
      ],
    },
    {
      id: "invoiceFooter",
      label: "$helio.settings.fields.invoiceFooter",
      description: "$helio.settings.descriptions.invoiceFooter",
      type: new DefaultDataTypes.RichTextType(),
    },
  ],
};

const collectionsSection: FormSection = {
  id: "collections",
  label: "$helio.settings.sections.collections",
  description: "$helio.settings.sections.collections_description",
  icon: "i-ph-hand-coins",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "lateFees",
      label: "$helio.settings.fields.lateFees",
      orientation: "horizontal",
      fields: [
        {
          id: "lateInterestRate",
          label: "$helio.settings.fields.lateInterestRate",
          type: new DefaultDataTypes.PercentageType({ max: 0.2 }),
          hint: "$helio.settings.hints.lateInterestRate",
        },
        {
          id: "recoveryFee",
          label: "$helio.settings.fields.recoveryFee",
          type: new DefaultDataTypes.PriceType({
            suffix: "$helio.settings.units.euro",
          }),
          hint: "$helio.settings.hints.recoveryFee",
        },
      ],
    },
    {
      id: "reminders",
      label: "$helio.settings.fields.reminders",
      description: "$helio.settings.descriptions.reminders",
      type: new DefaultDataTypes.ArrayType({
        of: {
          afterDays: {
            type: new DefaultDataTypes.NumberType({
              min: 1,
              max: 120,
              suffix: "$helio.settings.units.days",
            }),
            label: "$helio.settings.fields.reminderAfterDays",
            required: true,
          },
          channel: {
            type: new DefaultDataTypes.SelectType({ items: REMINDER_CHANNELS }),
            label: "$helio.settings.fields.reminderChannel",
            required: true,
          },
          template: {
            type: new DefaultDataTypes.SelectType({
              items: REMINDER_TEMPLATES,
            }),
            label: "$helio.settings.fields.reminderTemplate",
            required: true,
          },
        },
        sortable: true,
        max: MAX_REMINDERS,
        addLabel: "$helio.settings.actions.addReminder",
      }),
    },
  ],
};

/** The Finance part of the settings form: invoicing, then collections. */
export const financeSections: FormSection[] = [
  invoicingSection,
  collectionsSection,
];
