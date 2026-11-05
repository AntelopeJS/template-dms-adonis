import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  ResourceForm,
  type TableViewRowActionOptions,
} from "@antelopejs/interface-dms/base/table-view";
import type { CustomRowAction } from "@antelopejs/interface-dms/base/types/row-action";
import { CUSTOMERS_URL, PIPELINE_URL } from "../crm/links";
import { quoteController, type QuoteRow } from "./controller";
import { quoteActionUrl } from "./links";

const isDraft = { field: "status", equals: "draft" } as const;
const isSent = { field: "status", equals: "sent" } as const;

/**
 * Opened by a click on the row, its "Quick view" and `?record=<id>`, the link
 * other Helio pages (projects, dashboard) use to show one quote.
 */
const quickView: CustomRowAction<QuoteRow> = {
  id: "quick-view",
  label: "$helio.sales.quotes.actions.quickView",
  icon: "i-ph-sidebar-simple",
  isDefault: true,
  target: {
    type: "drawer",
    direction: "right",
    title: "$helio.sales.quotes.quickView.title",
    description: "$helio.sales.quotes.quickView.description",
    rowTitle: "{number}",
    positionLabel: "$helio.sales.quotes.quickView.position",
    deepLink: true,
    notFound: {
      title: "$helio.sales.quotes.quickView.notFoundTitle",
      description: "$helio.sales.quotes.quickView.notFoundDescription",
    },
    component: ResourceForm(quoteController, {
      mode: "view",
      rowId: "{{row._id}}",
    }),
  },
};

/**
 * Sends a draft to its customer. The server words the confirmation dialog: it
 * names the customer, the address the quote goes to and what changes once it
 * is sent.
 */
const send: CustomRowAction<QuoteRow> = {
  id: "send",
  label: "$helio.sales.quotes.actions.send",
  icon: "i-ph-paper-plane-tilt",
  color: "primary",
  permission: "edit",
  rule: isDraft,
  confirm: { from: quoteActionUrl("send-confirm") },
  target: {
    type: "api",
    url: quoteActionUrl("send"),
    method: "POST",
    successMessage: "$helio.sales.quotes.send.success",
  },
};

const accept: CustomRowAction<QuoteRow> = {
  id: "accept",
  label: "$helio.sales.quotes.actions.accept",
  icon: "i-ph-seal-check",
  color: "success",
  permission: "edit",
  rule: isSent,
  confirm: {
    title: "$helio.sales.quotes.accept.title",
    description: "$helio.sales.quotes.accept.description",
    icon: "i-ph-seal-check",
    color: "success",
    confirmLabel: "$helio.sales.quotes.accept.confirm",
  },
  target: {
    type: "api",
    url: quoteActionUrl("accept"),
    method: "POST",
    successMessage: "$helio.sales.quotes.accept.success",
  },
};

/** Marks a sent quote rejected. The reason, when given, is kept with the quote (its own field). */
const reject: CustomRowAction<QuoteRow> = {
  id: "reject",
  label: "$helio.sales.quotes.actions.reject",
  icon: "i-ph-x-circle",
  color: "error",
  permission: "edit",
  rule: isSent,
  confirm: {
    title: "$helio.sales.quotes.reject.title",
    description: "$helio.sales.quotes.reject.description",
    icon: "i-ph-x-circle",
    color: "error",
    confirmLabel: "$helio.sales.quotes.reject.confirm",
    fields: [
      {
        id: "reason",
        label: "$helio.sales.quotes.reject.reason",
        type: new DefaultDataTypes.StringType({
          maxLength: 200,
          placeholder: "$helio.sales.quotes.reject.reasonPlaceholder",
        }),
      },
    ],
  },
  target: {
    type: "api",
    url: quoteActionUrl("reject"),
    method: "POST",
    successMessage: "$helio.sales.quotes.reject.success",
  },
};

/** Copies the portal link. A draft has none yet: the customer receives it when the quote is sent. */
const copyPortalLink: CustomRowAction<QuoteRow> = {
  id: "portal-link",
  label: "$helio.sales.quotes.actions.portalLink",
  icon: "i-ph-link",
  rule: { not: isDraft },
  target: {
    type: "api",
    url: quoteActionUrl("portal-link"),
    method: "POST",
    copy: "url",
    successMessage: "$helio.sales.quotes.portalLink.success",
  },
};

const downloadPdf: CustomRowAction<QuoteRow> = {
  id: "download",
  label: "$helio.sales.quotes.actions.download",
  icon: "i-ph-file-pdf",
  target: {
    type: "download",
    url: quoteActionUrl("document"),
    filename: "{{row.number}}.pdf",
  },
};

/**
 * Opens the customers page on the quote's customer. A relation column lists
 * the related row (`{ _id, name }`), not its id, so the link names its `_id`.
 */
const openCustomer: CustomRowAction<QuoteRow> = {
  id: "customer",
  label: "$helio.sales.quotes.actions.customer",
  icon: "i-ph-user-circle",
  target: { type: "page", url: `${CUSTOMERS_URL}?record={{row.customer._id}}` },
};

/** Opens the pipeline narrowed to the customer's deals (its `?customer=` filter). */
const openDeals: CustomRowAction<QuoteRow> = {
  id: "deals",
  label: "$helio.sales.quotes.actions.deals",
  icon: "i-ph-kanban",
  target: {
    type: "page",
    url: `${PIPELINE_URL}?customer={{row.customer._id}}`,
  },
};

/**
 * The row actions of the quotes table: the life cycle of a quote (send,
 * accept, reject), what a salesperson hands the customer (the document, the
 * portal link), and the way to the customer and the deal. Only a draft can be
 * edited or deleted: a sent quote is what the customer holds. The quick view
 * shows a quote, so there is no details page besides it.
 */
export const quoteRowActions: TableViewRowActionOptions<QuoteRow> = {
  add: {
    placement: "header",
    label: "$helio.sales.quotes.actions.new",
    icon: "i-ph-file-plus",
  },
  edit: { isEnabled: true, rule: isDraft },
  details: false,
  duplicate: { label: "$helio.sales.quotes.actions.duplicate" },
  delete: {
    isEnabled: true,
    rule: isDraft,
    successMessage: "$helio.sales.quotes.deleted",
  },
  hasSelection: true,
  custom: [
    quickView,
    send,
    accept,
    reject,
    copyPortalLink,
    downloadPdf,
    openCustomer,
    openDeals,
  ],
};
