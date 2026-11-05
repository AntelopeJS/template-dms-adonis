/** The pipeline page (`/helio/sales/<page id>`, from the Helio page ids and categories). */
export const PIPELINE_URL = "/helio/sales/pipeline";
/** The customers page. */
export const CUSTOMERS_URL = "/helio/sales/customers";

/** The quotes page, narrowed to one customer by its `?customer=<id>` filter. */
export const QUOTES_URL = "/helio/sales/quotes";
/** The projects page, narrowed to one customer by its `?customer=<id>` filter. */
export const PROJECTS_URL = "/helio/operations/projects";
/** The invoices page, narrowed to one customer by its `?customer=<id>` filter. */
export const INVOICES_URL = "/helio/invoices";

/** Opens a customer's quick view: the customers page reads `?record=<id>`. */
export const CUSTOMER_QUICK_VIEW_URL = `${CUSTOMERS_URL}?record={{row.customer._id}}`;

/** The CRM routes' base path. */
export const CRM_API = "/api/helio/crm";
/** The delete dialog of a customer, worded by the server for that row. */
export const CUSTOMER_DELETE_CONFIRM_URL = `${CRM_API}/customers/{{row._id}}/delete-confirm`;
