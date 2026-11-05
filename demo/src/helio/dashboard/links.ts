/**
 * URLs of the Helio pages the dashboard links to. Plain strings rather than
 * tableViewLink(PageClass, …): the dashboard must not import every other
 * domain's page module, and these paths are the contract of the Helio spec.
 */
export const HELIO_PAGES = {
  dashboard: "/helio/dashboard",
  pipeline: "/helio/sales/pipeline",
  quotes: "/helio/sales/quotes",
  customers: "/helio/sales/customers",
  catalog: "/helio/sales/catalog",
  projects: "/helio/operations/projects",
  project: "/helio/operations/project",
  service: "/helio/operations/service",
  team: "/helio/operations/team",
  invoices: "/helio/invoices",
  monitoring: "/helio/monitoring",
  settings: "/helio/settings",
} as const;
