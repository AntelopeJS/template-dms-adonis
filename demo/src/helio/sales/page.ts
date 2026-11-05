import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { TableView } from "@antelopejs/interface-dms/base/table-view";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { helioSalesCategory } from "../category";
import { helioQuickActions } from "../shared/quick-actions";
import { quoteRowActions } from "./actions";
import { afterQuoteWrite } from "./customer-names";
import { assertVatRate } from "./vat-rate";
import { QUOTE_STATUSES, quoteController } from "./controller";
import { loadQuoteNumbers } from "./numbering";
import { quoteViews } from "./views";

/** One tab per status, each counting its quotes. */
const statusTabs = QUOTE_STATUSES.map((status) => ({
  id: status.value,
  label: status.label,
  icon: status.icon,
  iconColor: status.iconColor,
  textColor: status.textColor,
  filter: { accessorKey: "status", value: status.value, mode: "is" },
}));

/**
 * The quotes Helio sends its customers: drafted with their lines, sent for
 * signature, then accepted (the start of a project) or lost.
 */
@RegisterPage()
export class PageHelioQuotes extends PageController(
  "quotes",
  {
    displayName: "$helio.sales.quotes.page.name",
    description: "$helio.sales.quotes.page.description",
    icon: "i-ph-file-text",
    category: helioSalesCategory,
    order: 1,
  },
  DefaultLayout({ fullWidth: true }),
) {
  /**
   * The quotes table. `?customer=<id>` and `?deal=<id>` filter it, for the links
   * from the customers and the pipeline. The expanded row shows the lines on
   * the left and the amounts on the right (two columns, filled row by row).
   * Before a new quote is written, the guard checks the VAT rate (a business
   * pays the standard rate) and reads the numbers already used, as the write
   * cannot wait for the database; after it, the stored customer name follows.
   * An edit only sends what changed, so the stored row fills the rest before
   * the same check.
   */
  static table = TableView(quoteController, {
    caption: "$helio.sales.quotes.table.caption",
    labelKey: "number",
    searchPlaceholder: "$helio.sales.quotes.table.search",
    rowClick: "single",
    defaultSort: { field: "issuedAt", desc: true },
    pageSize: 25,
    tabs: statusTabs,
    views: quoteViews,
    quickFilters: [
      { field: "customer", label: "$helio.sales.quotes.quickFilters.customer" },
    ],
    queryParamFilters: {
      customer: {
        field: "customer",
        visible: true,
        label: "$helio.sales.quotes.chips.customer",
      },
      deal: {
        field: "deal",
        visible: true,
        label: "$helio.sales.quotes.chips.deal",
      },
    },
    expandable: {
      fieldsLabel: "$helio.sales.quotes.expand.label",
      fields: [
        "firstLine",
        "subtotal",
        "otherLines",
        "vatAmount",
        "deal",
        "total",
      ],
    },
    footer: {
      countLabel: "$helio.sales.quotes.table.count",
      summary: [
        {
          label: "$helio.sales.quotes.footer.total",
          field: "total",
          op: "sum",
        },
        {
          label: "$helio.sales.quotes.footer.accepted",
          field: "total",
          op: "sum",
          where: { field: "status", equals: "accepted" },
        },
        {
          label: "$helio.sales.quotes.footer.awaiting",
          op: "count",
          where: { field: "status", equals: "sent" },
        },
      ],
    },
    emptyStates: {
      firstRun: {
        title: "$helio.sales.quotes.empty.firstRunTitle",
        description: "$helio.sales.quotes.empty.firstRunDescription",
        icon: "i-ph-file-text",
      },
      filtered: {
        title: "$helio.sales.quotes.empty.filteredTitle",
        description: "$helio.sales.quotes.empty.filteredDescription",
        icon: "i-ph-magnifying-glass",
      },
    },
    formContainer: {
      type: "page",
      pages: {
        new: {
          displayName: "$helio.sales.quotes.form.newTitle",
          description: "$helio.sales.quotes.form.newDescription",
        },
        edit: {
          displayName: "$helio.sales.quotes.form.editTitle",
          description: "$helio.sales.quotes.form.editDescription",
        },
        details: {
          displayName: "$helio.sales.quotes.form.detailsTitle",
        },
      },
    },
    rowActions: quoteRowActions,
    guards: {
      new: async (_ctx, { body }) => {
        await assertVatRate(body.customer, body.vatRate);
        await loadQuoteNumbers();
        return afterQuoteWrite;
      },
      edit: async (_ctx, { body, current }) => {
        const row = { ...current, ...body };
        await assertVatRate(row.customer, row.vatRate);
        return afterQuoteWrite;
      },
    },
  });
}

QuickAction("helio-new-quote", {
  category: helioQuickActions,
  displayName: "$helio.sales.quotes.quickAction",
  icon: "i-ph-file-plus",
  target: {
    type: "openForm",
    page: PageHelioQuotes,
    component: PageHelioQuotes.table,
  },
});
