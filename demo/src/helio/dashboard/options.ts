/**
 * The kinds of event the activity feed lists, with the label and icon each is
 * drawn with.
 */
export const ACTIVITY_TYPES = [
  {
    value: "deal_won",
    label: "$helio.dashboard.activityTypes.dealWon",
    icon: "i-ph-trophy",
    iconColor: "success",
  },
  {
    value: "quote_sent",
    label: "$helio.dashboard.activityTypes.quoteSent",
    icon: "i-ph-paper-plane-tilt",
    iconColor: "info",
  },
  {
    value: "quote_accepted",
    label: "$helio.dashboard.activityTypes.quoteAccepted",
    icon: "i-ph-seal-check",
    iconColor: "success",
  },
  {
    value: "project_started",
    label: "$helio.dashboard.activityTypes.projectStarted",
    icon: "i-ph-hard-hat",
    iconColor: "primary",
  },
  {
    value: "project_done",
    label: "$helio.dashboard.activityTypes.projectDone",
    icon: "i-ph-solar-panel",
    iconColor: "success",
  },
  {
    value: "ticket_opened",
    label: "$helio.dashboard.activityTypes.ticketOpened",
    icon: "i-ph-lifebuoy",
    iconColor: "warning",
  },
  {
    value: "ticket_resolved",
    label: "$helio.dashboard.activityTypes.ticketResolved",
    icon: "i-ph-check-circle",
    iconColor: "success",
  },
  {
    value: "ticket_reopened",
    label: "$helio.dashboard.activityTypes.ticketReopened",
    icon: "i-ph-arrow-counter-clockwise",
    iconColor: "warning",
  },
  {
    value: "invoice_paid",
    label: "$helio.dashboard.activityTypes.invoicePaid",
    icon: "i-ph-currency-eur",
    iconColor: "success",
  },
  {
    value: "invoice_overdue",
    label: "$helio.dashboard.activityTypes.invoiceOverdue",
    icon: "i-ph-warning-circle",
    iconColor: "error",
  },
] as const;
