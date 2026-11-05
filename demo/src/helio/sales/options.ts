import { DAY_MS } from "../shared/seed";

/**
 * A quote's life, in order, with the label and colours of each status.
 * controller.ts re-exports it: that is the import path other domains use.
 */
export const QUOTE_STATUSES = [
  {
    value: "draft",
    label: "$helio.sales.quotes.statuses.draft",
    icon: "i-ph-pencil-simple-line",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "sent",
    label: "$helio.sales.quotes.statuses.sent",
    icon: "i-ph-paper-plane-tilt",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "accepted",
    label: "$helio.sales.quotes.statuses.accepted",
    icon: "i-ph-seal-check",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "rejected",
    label: "$helio.sales.quotes.statuses.rejected",
    icon: "i-ph-x-circle",
    iconColor: "error",
    textColor: "error",
  },
  {
    value: "expired",
    label: "$helio.sales.quotes.statuses.expired",
    icon: "i-ph-hourglass-simple-low",
    iconColor: "warning",
    textColor: "warning",
  },
] as const;

/** How long a quote holds when its validity is left empty. */
export const VALIDITY_DAYS = 30;

/** A sent quote this close to its end of validity is flagged. */
export const EXPIRING_WITHIN_MS = 7 * DAY_MS;
