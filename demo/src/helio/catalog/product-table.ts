import type { ProductRow } from "./product-controller";
import type { TableViewOptions } from "@antelopejs/interface-dms/base/table-view";
import { SERVICES_FAMILY } from "./options";

/**
 * The saved views of the catalog table. The to-reorder view switches to the
 * grid with the threshold beside the stock, which reads better than cards for
 * that list.
 */
const VIEWS: TableViewOptions["views"] = {
  layout: "strip",
  defaultView: "all",
  userViews: true,
  items: [
    {
      id: "all",
      label: "$helio.catalog.products.views.all",
      icon: "i-ph-squares-four",
    },
    {
      id: "active",
      label: "$helio.catalog.products.views.active",
      icon: "i-ph-storefront",
      count: true,
      filters: [{ accessorKey: "isActive", mode: "is", value: "true" }],
    },
    {
      id: "to-reorder",
      label: "$helio.catalog.products.views.toReorder",
      icon: "i-ph-warning",
      tone: "error",
      count: true,
      filters: [
        { accessorKey: "lowStock", mode: "is", value: "true" },
        { accessorKey: "isActive", mode: "is", value: "true" },
      ],
      display: "table",
      columns: { visible: ["stockMin"], hidden: ["margin"] },
    },
    {
      id: "hardware",
      label: "$helio.catalog.products.views.hardware",
      icon: "i-ph-cube",
      count: true,
      filters: [
        { accessorKey: "family", mode: "is_not", value: SERVICES_FAMILY },
      ],
    },
    {
      id: "services",
      label: "$helio.catalog.products.views.services",
      icon: "i-ph-wrench",
      count: true,
      filters: [{ accessorKey: "family", mode: "is", value: SERVICES_FAMILY }],
    },
    {
      id: "by-family",
      label: "$helio.catalog.products.views.byFamily",
      icon: "i-ph-rows",
      display: "grouped",
    },
    {
      id: "discontinued",
      label: "$helio.catalog.products.views.discontinued",
      icon: "i-ph-archive",
      tone: "neutral",
      count: true,
      filters: [{ accessorKey: "isActive", mode: "is", value: "false" }],
    },
  ],
};

const FORMS: TableViewOptions["formContainer"] = {
  type: "modal",
  size: "lg",
  pages: {
    new: {
      displayName: "$helio.catalog.products.form.newTitle",
      description: "$helio.catalog.products.form.newDescription",
    },
    edit: {
      displayName: "$helio.catalog.products.form.editTitle",
      description: "$helio.catalog.products.form.editDescription",
    },
    details: { displayName: "$helio.catalog.products.form.detailsTitle" },
  },
};

/**
 * How the catalog page shows the products. Kept apart from the page so the
 * page reads as its blocks.
 */
export const productTableOptions: TableViewOptions<ProductRow> = {
  caption: "$helio.catalog.products.caption",
  labelKey: "name",
  searchPlaceholder: "$helio.catalog.products.search",
  /**
   * Cards first: a catalog is browsed by its pictures. The grid and the
   * grouped display stay one click away.
   */
  displays: [{ id: "cards" }, { id: "table" }],
  defaultDisplay: "cards",
  card: {
    fields: ["picture", "price", "category", "stock", "margin", "stockLevel"],
  },
  /**
   * Grouped by range and not by family: with `reorder`, the grouped display
   * still lists the rows by position instead of by group, and a database
   * computed field (the family) is only returned when sorted on. The seeded
   * positions keep each range together, so the groups read right.
   */
  grouped: { groupByField: "category", collapsible: true, count: true },
  /**
   * The order the sales team sets by hand, which quotes follow too. Every
   * product fits on one page, so any product can be moved anywhere.
   */
  reorder: { field: "displayOrder" },
  pageSize: 25,
  expandable: {
    fields: ["description", "tags", "unit", "power", "cost", "warrantyYears"],
  },
  quickFilters: [
    { field: "family", icon: "i-ph-stack" },
    { field: "unit", icon: "i-ph-ruler" },
  ],
  views: VIEWS,
  footer: {
    countLabel: "$helio.catalog.products.footer.count",
    summary: [
      {
        label: "$helio.catalog.products.footer.units",
        field: "stock",
        op: "sum",
      },
      {
        label: "$helio.catalog.products.footer.onSale",
        op: "count",
        where: { field: "isActive", equals: true },
      },
    ],
  },
  emptyStates: {
    firstRun: {
      title: "$helio.catalog.products.empty.firstRunTitle",
      description: "$helio.catalog.products.empty.firstRunDescription",
      icon: "i-ph-package",
    },
    filtered: {
      title: "$helio.catalog.products.empty.filteredTitle",
      description: "$helio.catalog.products.empty.filteredDescription",
      icon: "i-ph-magnifying-glass",
    },
  },
  formContainer: FORMS,
  rowActions: {
    add: true,
    edit: true,
    duplicate: true,
    details: true,
    copyLink: true,
    hasSelection: true,
    delete: {
      isEnabled: true,
      confirm: {
        title: "$helio.catalog.products.delete.title",
        description: "$helio.catalog.products.delete.description",
        icon: "i-ph-trash",
        color: "error",
        confirmLabel: "$helio.catalog.products.delete.confirm",
      },
    },
  },
};
