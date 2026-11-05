/** The quotes page (contract: /helio/sales/<page id>). */
export const QUOTES_PAGE_URL = "/helio/sales/quotes";

/**
 * The routes of the quote row actions (send, accept, document…). Kept apart
 * from routes.ts, which imports the page, so the page's row actions can use it
 * without an import cycle.
 */
export const QUOTE_ACTIONS_API = "/api/helio/quote-actions";

/** A quote action route, for the row named by `{{row._id}}`. */
export function quoteActionUrl(action: string): string {
  return `${QUOTE_ACTIONS_API}/${action}?id={{row._id}}`;
}

/** Where a customer opens the quote sent to them (a fictional portal). */
export const PORTAL_BASE_URL = "https://portail.helio.example/devis";
