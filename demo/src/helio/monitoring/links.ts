import { pageRoutePath } from "@antelopejs/interface-dms/page";

/** The page URL, as in the Helio contract. */
export const MONITORING_PAGE_PATH = "/helio/monitoring";

/** Id of the page's PeriodSelector, and the prefix of its URL keys. */
export const PERIOD_SCOPE = "fleet";

/** Published on every round of inverter reports; every block listens. */
export const TELEMETRY_TOPIC = "helio:telemetry";

/** A route declared on the page class, as the browser calls it. */
export const monitoringRoute = (route: string): string =>
  pageRoutePath(MONITORING_PAGE_PATH, route);
