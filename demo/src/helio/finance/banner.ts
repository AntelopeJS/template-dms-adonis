import { GetModel } from "@antelopejs/interface-database-decorators";
import type { BannerContent } from "@antelopejs/interface-dms/base/banner";
import { tableViewLink } from "@antelopejs/interface-dms/base/table-view";
import { sweepOverdueInvoices } from "./actions";
import { InvoiceModel } from "./database";
import { PageHelioInvoices } from "./page";

/**
 * A warning while invoices are overdue: how many and how much, with a button
 * to the overdue tab, or `null` when none is. A block of the Helio dashboard,
 * not a layout banner, since those show on every page of the platform and the
 * invoices list already says it in its overdue KPI. Resolved per request, so
 * it goes away by itself once the last overdue invoice is paid. Archived
 * invoices are left out, like in the overdue tab the button opens.
 */
export async function overdueInvoicesBanner(): Promise<BannerContent | null> {
  await sweepOverdueInvoices();
  const overdue = (
    await GetModel(InvoiceModel).getBy("status", "overdue")
  ).filter((invoice) => !invoice.isArchived);
  if (overdue.length === 0) return null;
  const amount = overdue.reduce(
    (total, invoice) => total + invoice.amountDue,
    0,
  );
  return {
    tone: "warning",
    icon: "i-ph-warning-circle",
    size: "sm",
    title: {
      key: "$helio.finance.banner.overdue",
      params: {
        count: { type: "count", value: overdue.length },
        amount: {
          type: "money",
          value: Math.round(amount * 100),
          currency: "EUR",
        },
      },
    },
    actions: [
      {
        label: "$helio.finance.banner.action",
        to: tableViewLink(PageHelioInvoices, "table", { tab: "overdue" }),
        icon: "i-ph-arrow-right",
      },
    ],
  };
}
