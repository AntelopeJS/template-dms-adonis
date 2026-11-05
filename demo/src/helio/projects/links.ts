/**
 * The projects list (planning, grid and board). The URLs of this file are kept
 * apart from the page classes so the routes and the pages can both read them
 * without importing each other.
 */
export const PROJECTS_PAGE_URL = "/helio/operations/projects";

/** The detail page of one project, its `_id` in the path. */
export const PROJECT_PAGE_URL = "/helio/operations/project";

/** A link to one project's detail page, for a row action or a feed entry. */
export function projectPageUrl(projectId: string): string {
  return `${PROJECT_PAGE_URL}/${encodeURIComponent(projectId)}`;
}

/** The routes of the detail page, scoped by the project `_id`. */
export const PROJECT_DETAIL_API = "/api/helio/project-detail";

/** A detail route of the project the page URL names (`{{params.id}}`). */
export function projectDetailRoute(route: string): string {
  return `${PROJECT_DETAIL_API}/{{params.id}}/${route}`;
}

/**
 * The other Helio pages a project links to. They open the record through
 * `?record=<id>`, the deep link the dashboard's activity links use too.
 */
export const HELIO_RECORD_LINKS = {
  customer: "/helio/sales/customers?record=",
  quote: "/helio/sales/quotes?record=",
  invoice: "/helio/invoices?record=",
  member: "/helio/operations/team?record=",
} as const;

/** A link opening a record of another Helio page. */
export function recordLink(
  kind: keyof typeof HELIO_RECORD_LINKS,
  id: string,
): string {
  return `${HELIO_RECORD_LINKS[kind]}${encodeURIComponent(id)}`;
}

/** Driving directions to a site address, in Google Maps. */
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
