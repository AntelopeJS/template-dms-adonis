import { QuickActionCategory } from "@antelopejs/interface-dms/quick-actions";

/**
 * One command palette group (Ctrl/Cmd+K) for every Helio shortcut. Each domain
 * registers its own QuickAction(...) in this category, next to its page.
 */
export const helioQuickActions = QuickActionCategory("helio", {
  displayName: "$helio.nav.root",
  icon: "i-ph-sun",
  order: 0,
});
