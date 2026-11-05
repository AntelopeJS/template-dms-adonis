import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";

/** The units a product is sold in, shared by the catalog and the other domains' filters and views. */
export const PRODUCT_UNITS = [
  { value: "piece", label: "$helio.catalog.units.piece", icon: "i-ph-package" },
  { value: "hour", label: "$helio.catalog.units.hour", icon: "i-ph-clock" },
  { value: "year", label: "$helio.catalog.units.year", icon: "i-ph-calendar" },
  { value: "flat", label: "$helio.catalog.units.flat", icon: "i-ph-tag" },
] as const;

/**
 * The top-level families of the category tree (PRODUCT_CATEGORY_ROSTER). A
 * product's family is read from its category's parent, in the database, so
 * the catalog can filter on five families. The catalog groups by range (the
 * product's category), not by family.
 */
export const PRODUCT_FAMILIES = [
  {
    value: "cat-panels",
    label: "$helio.catalog.families.panels",
    icon: "i-ph-solar-panel",
    iconColor: "info",
  },
  {
    value: "cat-inverters",
    label: "$helio.catalog.families.inverters",
    icon: "i-ph-lightning",
    iconColor: "success",
  },
  {
    value: "cat-storage",
    label: "$helio.catalog.families.storage",
    icon: "i-ph-battery-charging",
    iconColor: "warning",
  },
  {
    value: "cat-ev",
    label: "$helio.catalog.families.ev",
    icon: "i-ph-charging-station",
    iconColor: "secondary",
  },
  {
    value: "cat-services",
    label: "$helio.catalog.families.services",
    icon: "i-ph-wrench",
    iconColor: "neutral",
  },
] as const;

export type ProductFamily = (typeof PRODUCT_FAMILIES)[number]["value"];

export const SERVICES_FAMILY: ProductFamily = "cat-services";

/** Tags offered while typing; they stay free tags. */
export const PRODUCT_TAGS = [
  "bestseller",
  "résidentiel",
  "entreprises",
  "batterie",
  "borne",
  "hybride",
  "triphasé",
  "service",
  "contrat",
];

/** A stock under this many times its threshold is running low. */
export const LOW_STOCK_MARGIN = 1.5;

export const STOCK_LEVELS = [
  {
    value: "in_stock",
    label: "$helio.catalog.products.stockLevels.inStock",
    icon: "i-ph-check-circle",
    iconColor: "success",
  },
  {
    value: "running_low",
    label: "$helio.catalog.products.stockLevels.runningLow",
    icon: "i-ph-trend-down",
    iconColor: "warning",
  },
  {
    value: "reorder",
    label: "$helio.catalog.products.stockLevels.reorder",
    icon: "i-ph-warning",
    iconColor: "error",
    textColor: "error",
  },
  {
    value: "not_stocked",
    label: "$helio.catalog.products.stockLevels.notStocked",
    icon: "i-ph-minus-circle",
    iconColor: "neutral",
  },
] as const;

export type StockLevel = (typeof STOCK_LEVELS)[number]["value"];

/**
 * Read-only figures shown on the product sheet, not in the forms that create
 * or edit a product.
 */
export const FORMS_ONLY_VIEW = {
  new: ReadonlyBehaviorType.hidden,
  edit: ReadonlyBehaviorType.hidden,
};
