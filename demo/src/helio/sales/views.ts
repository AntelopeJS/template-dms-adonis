import type { TableViewViewsOptions } from "@antelopejs/interface-dms/base/table-view";

/**
 * The saved ways of looking at the quotes, drawn as a strip above the status
 * tabs and opened from the URL (`?table.view=<id>`). "Awaiting" is the sent
 * quotes not answered yet, the closest end of validity first. "Expiring" is
 * the sent quotes whose validity ends within a week: time to call. "Accepted"
 * is the quotes signed in the last 30 days: filter tokens move by whole days
 * only (`{{now-30d}}`), so that is the closest they can say to "this month".
 */
export const quoteViews: TableViewViewsOptions = {
  layout: "strip",
  defaultView: "all",
  userViews: true,
  items: [
    {
      id: "all",
      label: "$helio.sales.quotes.views.all",
      icon: "i-ph-squares-four",
    },
    {
      id: "awaiting",
      label: "$helio.sales.quotes.views.awaiting",
      icon: "i-ph-signature",
      tone: "info",
      count: true,
      filters: [{ accessorKey: "status", mode: "is", value: "sent" }],
      sort: [{ field: "validUntil" }],
    },
    {
      id: "expiring",
      label: "$helio.sales.quotes.views.expiring",
      icon: "i-ph-hourglass-medium",
      tone: "warning",
      count: true,
      filters: [
        { accessorKey: "status", mode: "is", value: "sent" },
        {
          accessorKey: "validUntil",
          mode: "is_between",
          value: "{{now}},{{now+7d}}",
        },
      ],
      sort: [{ field: "validUntil" }],
    },
    {
      id: "accepted",
      label: "$helio.sales.quotes.views.accepted",
      icon: "i-ph-seal-check",
      tone: "success",
      count: true,
      filters: [
        { accessorKey: "status", mode: "is", value: "accepted" },
        {
          accessorKey: "signedAt",
          mode: "greater_than",
          value: "{{now-30d}}",
        },
      ],
      sort: [{ field: "signedAt", desc: true }],
      columns: { visible: ["signedAt"] },
    },
  ],
};
