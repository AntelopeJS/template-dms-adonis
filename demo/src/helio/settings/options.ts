/**
 * The legal forms of the company. Like the other option lists of the settings
 * form, `value` is what the settings document stores and `label` an i18n key of
 * helio-settings-*.json.
 */
export const LEGAL_FORMS = [
  { value: "srl", label: "$helio.settings.legalForms.srl" },
  { value: "sa", label: "$helio.settings.legalForms.sa" },
  { value: "sc", label: "$helio.settings.legalForms.sc" },
  { value: "snc", label: "$helio.settings.legalForms.snc" },
  { value: "sole", label: "$helio.settings.legalForms.sole" },
];

/** The days of the week the crews can work. */
export const WEEKDAYS = [
  { value: "mon", label: "$helio.settings.weekdays.mon" },
  { value: "tue", label: "$helio.settings.weekdays.tue" },
  { value: "wed", label: "$helio.settings.weekdays.wed" },
  { value: "thu", label: "$helio.settings.weekdays.thu" },
  { value: "fri", label: "$helio.settings.weekdays.fri" },
  { value: "sat", label: "$helio.settings.weekdays.sat" },
  { value: "sun", label: "$helio.settings.weekdays.sun" },
];

/** The channels an overdue-invoice reminder can go through. */
export const REMINDER_CHANNELS = [
  { value: "email", label: "$helio.settings.reminderChannels.email" },
  { value: "sms", label: "$helio.settings.reminderChannels.sms" },
  {
    value: "registered_mail",
    label: "$helio.settings.reminderChannels.registered_mail",
  },
];

/** The tones of an overdue-invoice reminder. */
export const REMINDER_TEMPLATES = [
  { value: "friendly", label: "$helio.settings.reminderTemplates.friendly" },
  { value: "firm", label: "$helio.settings.reminderTemplates.firm" },
  {
    value: "formal_notice",
    label: "$helio.settings.reminderTemplates.formal_notice",
  },
];

/** The events a webhook can subscribe to. */
export const WEBHOOK_EVENTS = [
  {
    value: "ticket.created",
    label: "$helio.settings.webhookEvents.ticket_created",
  },
  {
    value: "ticket.resolved",
    label: "$helio.settings.webhookEvents.ticket_resolved",
  },
  {
    value: "quote.accepted",
    label: "$helio.settings.webhookEvents.quote_accepted",
  },
  {
    value: "invoice.paid",
    label: "$helio.settings.webhookEvents.invoice_paid",
  },
  {
    value: "site.offline",
    label: "$helio.settings.webhookEvents.site_offline",
  },
];

/** The accounting packages the company can connect. */
export const ACCOUNTING_SOFTWARE = [
  {
    value: "winbooks",
    label: "$helio.settings.accounting.winbooks_label",
    description: "$helio.settings.accounting.winbooks",
  },
  {
    value: "yuki",
    label: "$helio.settings.accounting.yuki_label",
    description: "$helio.settings.accounting.yuki",
  },
  {
    value: "exact",
    label: "$helio.settings.accounting.exact_label",
    description: "$helio.settings.accounting.exact",
  },
  {
    value: "none",
    label: "$helio.settings.accounting.none_label",
    description: "$helio.settings.accounting.none",
  },
];

/** The channels alerts are sent through. */
export const ALERT_CHANNELS = [
  {
    value: "email",
    label: "$helio.settings.alertChannels.email",
    description: "$helio.settings.alertChannels.email_description",
    icon: "i-ph-envelope-simple",
  },
  {
    value: "sms",
    label: "$helio.settings.alertChannels.sms",
    description: "$helio.settings.alertChannels.sms_description",
    icon: "i-ph-device-mobile",
  },
  {
    value: "teams",
    label: "$helio.settings.alertChannels.teams",
    description: "$helio.settings.alertChannels.teams_description",
    icon: "i-ph-chats-circle",
  },
  {
    value: "dashboard",
    label: "$helio.settings.alertChannels.dashboard",
    description: "$helio.settings.alertChannels.dashboard_description",
    icon: "i-ph-bell-ringing",
  },
];

/** How often the notification digest is sent. */
export const DIGEST_FREQUENCIES = [
  { value: "off", label: "$helio.settings.digest.off" },
  { value: "daily", label: "$helio.settings.digest.daily" },
  { value: "weekly", label: "$helio.settings.digest.weekly" },
];

/** Provinces and regions offered as intervention zones. */
export const ZONE_SUGGESTIONS = [
  "Liège",
  "Namur",
  "Bruxelles",
  "Hainaut",
  "Luxembourg",
  "Brabant wallon",
  "Limbourg",
  "Brabant flamand",
];

/**
 * Placeholders of the alert payload template, offered by its autocomplete. The
 * editor shows `detail` untranslated, so the entries carry none.
 */
export const PAYLOAD_COMPLETIONS = [
  { label: "{{site.name}}", icon: "i-ph-solar-panel" },
  { label: "{{site.city}}", icon: "i-ph-map-pin" },
  { label: "{{alert.kind}}", icon: "i-ph-warning" },
  { label: "{{alert.at}}", icon: "i-ph-clock" },
  { label: "{{customer.name}}", icon: "i-ph-user" },
];
