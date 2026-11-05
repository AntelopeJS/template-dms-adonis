import type { TableViewViewsOptions } from "@antelopejs/interface-dms/base/table-view";

/**
 * The "open deals" filter of the saved views. A list filter takes one value per
 * column, so it reads the stored `isOpen` flag of the deal controller.
 */
const OPEN = { accessorKey: "isOpen", mode: "is", value: "true" };

/**
 * A deal this big is a commercial roof or a carport: the key account manager
 * follows it closely.
 */
const BIG_DEAL_EUR = "50000";

export const PIPELINE_VIEWS: TableViewViewsOptions = {
  layout: "tabs",
  defaultView: "board",
  userViews: true,
  items: [
    {
      id: "board",
      label: "$helio.crm.pipeline.views.board",
      icon: "i-ph-kanban",
      display: "kanban",
    },
    {
      id: "closing",
      label: "$helio.crm.pipeline.views.closing",
      icon: "i-ph-calendar-check",
      tone: "primary",
      count: true,
      display: "table",
      filters: [
        OPEN,
        {
          accessorKey: "expectedClose",
          mode: "less_than",
          value: "{{now+30d}}",
        },
      ],
      sort: [{ field: "expectedClose" }],
    },
    {
      id: "big",
      label: "$helio.crm.pipeline.views.big",
      icon: "i-ph-trend-up",
      tone: "success",
      count: true,
      display: "table",
      filters: [
        OPEN,
        {
          accessorKey: "amount",
          mode: "greater_than_or_equal_to",
          value: BIG_DEAL_EUR,
        },
      ],
      sort: [{ field: "amount", desc: true }],
    },
    {
      id: "stalled",
      label: "$helio.crm.pipeline.views.stalled",
      icon: "i-ph-hourglass-medium",
      tone: "warning",
      count: true,
      display: "table",
      filters: [
        OPEN,
        {
          accessorKey: "lastActivityAt",
          mode: "less_than",
          value: "{{now-21d}}",
        },
      ],
      sort: [{ field: "lastActivityAt" }],
    },
    {
      id: "won",
      label: "$helio.crm.pipeline.views.won",
      icon: "i-ph-trophy",
      tone: "success",
      count: true,
      display: "table",
      filters: [{ accessorKey: "stage", mode: "is", value: "won" }],
      sort: [{ field: "expectedClose", desc: true }],
      columns: { hidden: ["probability", "weightedAmount"] },
    },
    {
      id: "lost",
      label: "$helio.crm.pipeline.views.lost",
      icon: "i-ph-x-circle",
      tone: "error",
      count: true,
      display: "table",
      filters: [{ accessorKey: "stage", mode: "is", value: "lost" }],
      sort: [{ field: "expectedClose", desc: true }],
      columns: {
        visible: ["lostReason"],
        hidden: ["probability", "weightedAmount", "nextStep"],
      },
    },
  ],
};
