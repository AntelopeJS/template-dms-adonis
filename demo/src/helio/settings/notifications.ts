import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import type {
  FormField,
  FormSection,
} from "@antelopejs/interface-dms/base/form";
import { ALERT_CHANNELS, DIGEST_FREQUENCIES } from "./options";

const MAX_RECIPIENTS = 20;

/** Who is alerted, and how: a section of the settings form. */
const notificationFields: FormField[] = [
  {
    id: "alertChannels",
    label: "$helio.settings.fields.alertChannels",
    description: "$helio.settings.descriptions.alertChannels",
    type: new DefaultDataTypes.SelectType({
      items: ALERT_CHANNELS,
      display: "cards",
      multiple: true,
    }),
  },
  {
    id: "digestFrequency",
    label: "$helio.settings.fields.digestFrequency",
    description: "$helio.settings.descriptions.digestFrequency",
    type: new DefaultDataTypes.SelectType({
      items: DIGEST_FREQUENCIES,
      display: "segmented",
    }),
  },
  {
    id: "notifyUrgentTickets",
    label: "$helio.settings.fields.notifyUrgentTickets",
    type: new DefaultDataTypes.BooleanType({
      display: "card",
      icon: "i-ph-fire",
      label: "$helio.settings.fields.notifyUrgentTickets_label",
      description: "$helio.settings.descriptions.notifyUrgentTickets",
    }),
  },
  {
    id: "notifyOfflineSites",
    label: "$helio.settings.fields.notifyOfflineSites",
    type: new DefaultDataTypes.BooleanType({
      label: "$helio.settings.fields.notifyOfflineSites_label",
      description: "$helio.settings.descriptions.notifyOfflineSites",
    }),
  },
  {
    id: "notifyOverdueInvoices",
    label: "$helio.settings.fields.notifyOverdueInvoices",
    type: new DefaultDataTypes.BooleanType({
      label: "$helio.settings.fields.notifyOverdueInvoices_label",
      description: "$helio.settings.descriptions.notifyOverdueInvoices",
    }),
  },
  {
    id: "alertRecipients",
    label: "$helio.settings.fields.alertRecipients",
    type: new DefaultDataTypes.TagsType({
      itemType: "email",
      max: MAX_RECIPIENTS,
      placeholder: "$helio.settings.placeholders.recipient",
    }),
    hint: "$helio.settings.hints.alertRecipients",
  },
];

/**
 * Saved with the rest of the form, through its save bar: an instant form on
 * the same page put "Saved instantly" in the page header, which read as true
 * for every section.
 */
export const notificationsSection: FormSection = {
  id: "notifications",
  label: "$helio.settings.sections.notifications",
  description: "$helio.settings.sections.notifications_description",
  icon: "i-ph-bell",
  navGroup: "$helio.settings.groups.operations",
  fields: notificationFields,
};
