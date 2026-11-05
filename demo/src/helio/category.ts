import { Category, RootCategory } from "@antelopejs/interface-dms/page";

/**
 * Helio: a complete business app for a solar installer, built only from the
 * DMS's generic blocks. Its own top-level sidebar section sits between the
 * built-in Pages (1) and Modules (2) sections.
 */
export const helioCategory = RootCategory("helio", {
  displayName: "$helio.nav.root",
  icon: "i-ph-sun",
  order: 1.5,
});

/** Sales: pipeline, quotes, customers and the product catalog. */
export const helioSalesCategory = Category("sales", {
  displayName: "$helio.nav.sales",
  icon: "i-ph-handshake",
  category: helioCategory,
  order: 1,
});

/** Operations: installation projects, after-sales service and the team. */
export const helioOperationsCategory = Category("operations", {
  displayName: "$helio.nav.operations",
  icon: "i-ph-hard-hat",
  category: helioCategory,
  order: 2,
});
