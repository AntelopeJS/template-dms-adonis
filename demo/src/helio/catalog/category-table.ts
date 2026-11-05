import type { ProductCategoryRow } from "./category-controller";
import type { TableViewOptions } from "@antelopejs/interface-dms/base/table-view";
import { refuseUsedCategories } from "./category-usage";

/**
 * The ranges products are filed under, managed on the catalog page below the
 * products: a compact list sorted by name and edited in a small modal. The
 * family quick filter narrows it to one family, and deleting a category goes
 * through `refuseUsedCategories`.
 */
export const categoryTableOptions: TableViewOptions<ProductCategoryRow> = {
  caption: "$helio.catalog.categories.caption",
  labelKey: "name",
  layout: "compact",
  searchPlaceholder: "$helio.catalog.categories.search",
  defaultSort: { field: "name" },
  pageSize: 15,
  quickFilters: [{ field: "parent", icon: "i-ph-tree-structure" }],
  footer: { countLabel: "$helio.catalog.categories.footer.count" },
  emptyStates: {
    firstRun: {
      title: "$helio.catalog.categories.empty.title",
      description: "$helio.catalog.categories.empty.description",
      icon: "i-ph-tree-structure",
    },
  },
  formContainer: {
    type: "modal",
    size: "md",
    pages: {
      new: {
        displayName: "$helio.catalog.categories.form.newTitle",
        description: "$helio.catalog.categories.form.newDescription",
      },
      edit: { displayName: "$helio.catalog.categories.form.editTitle" },
    },
  },
  rowActions: {
    add: true,
    edit: true,
    delete: {
      isEnabled: true,
      confirm: {
        title: "$helio.catalog.categories.delete.title",
        description: "$helio.catalog.categories.delete.description",
        icon: "i-ph-trash",
        color: "error",
        confirmLabel: "$helio.catalog.categories.delete.confirm",
      },
    },
  },
  guards: {
    delete: (_context, { ids }) => refuseUsedCategories(ids),
  },
};
