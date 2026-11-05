import type { TicketPriority } from "./database";

/** Where the service desk lives (the page's category chain and id). */
export const SERVICE_DESK_PATH = "/helio/operations/service";

/**
 * Published whenever tickets change outside the data controller's own routes
 * (the simulator, the bulk actions): the desk's table, stats and badges read
 * again on it.
 */
export const SERVICE_TOPIC = "helio:tickets";

/**
 * Hours Helio promises to resolve a ticket in, by priority, from its creation.
 * An unresolved ticket past it breaches its SLA, whoever holds it: the desk,
 * the team page and the dashboard all count it so.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  normal: 72,
  low: 120,
};

/** The ticket statuses, with the label and the colors the desk shows them in (tabs, pills, legend). */
export const TICKET_STATUSES = [
  {
    value: "new",
    label: "$helio.service.statuses.new",
    icon: "i-ph-sparkle",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "open",
    label: "$helio.service.statuses.open",
    icon: "i-ph-wrench",
    iconColor: "primary",
    textColor: "primary",
  },
  {
    value: "waiting",
    label: "$helio.service.statuses.waiting",
    icon: "i-ph-hourglass-medium",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "resolved",
    label: "$helio.service.statuses.resolved",
    icon: "i-ph-check-circle",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "closed",
    label: "$helio.service.statuses.closed",
    icon: "i-ph-archive",
    iconColor: "neutral",
    textColor: "neutral",
  },
] as const;

/** The ticket priorities, with the label and the colors the desk shows them in. */
export const TICKET_PRIORITIES = [
  {
    value: "low",
    label: "$helio.service.priorities.low",
    icon: "i-ph-arrow-down",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "normal",
    label: "$helio.service.priorities.normal",
    icon: "i-ph-minus",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "high",
    label: "$helio.service.priorities.high",
    icon: "i-ph-arrow-up",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "urgent",
    label: "$helio.service.priorities.urgent",
    icon: "i-ph-fire",
    iconColor: "error",
    textColor: "error",
  },
] as const;

/** The ticket categories, with the label and the colors the desk shows them in. */
export const TICKET_CATEGORIES = [
  {
    value: "no_production",
    label: "$helio.service.categories.noProduction",
    icon: "i-ph-sun-dim",
    iconColor: "error",
    textColor: "error",
  },
  {
    value: "inverter_error",
    label: "$helio.service.categories.inverterError",
    icon: "i-ph-lightning-slash",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "monitoring",
    label: "$helio.service.categories.monitoring",
    icon: "i-ph-chart-line",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "damage",
    label: "$helio.service.categories.damage",
    icon: "i-ph-cloud-lightning",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "billing",
    label: "$helio.service.categories.billing",
    icon: "i-ph-receipt",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "other",
    label: "$helio.service.categories.other",
    icon: "i-ph-chat-circle-dots",
    iconColor: "neutral",
    textColor: "neutral",
  },
] as const;

/** The channels a ticket can arrive through, with the label and the colors the desk shows them in. */
export const TICKET_CHANNELS = [
  {
    value: "phone",
    label: "$helio.service.channels.phone",
    icon: "i-ph-phone",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "email",
    label: "$helio.service.channels.email",
    icon: "i-ph-envelope-simple",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "portal",
    label: "$helio.service.channels.portal",
    icon: "i-ph-browser",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "monitoring_alert",
    label: "$helio.service.channels.monitoringAlert",
    icon: "i-ph-bell-ringing",
    iconColor: "warning",
    textColor: "warning",
  },
] as const;
