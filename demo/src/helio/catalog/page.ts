import { Get } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import {
  TableView,
  tableViewLink,
} from "@antelopejs/interface-dms/base/table-view";
import {
  PageController,
  RegisterPage,
  pageRoutePath,
} from "@antelopejs/interface-dms/page";
import { helioSalesCategory } from "../category";
import { productCategoryController } from "./category-controller";
import { productController } from "./product-controller";
import { categoryTableOptions } from "./category-table";
import { ProductCategoryModel, ProductModel } from "./database";
import { productTableOptions } from "./product-table";
import { catalogStats } from "./stats";

const PAGE_SLUG = "/helio/sales/catalog";

/**
 * The product catalog: what Helio sells and installs, as cards with their
 * visual, grouped by range or as a grid, in the order the sales team set by
 * hand (the order quotes offer them in). The stock of each product reads
 * against its reorder threshold, and the ranges the products are filed under
 * are managed below.
 */
@RegisterPage()
export class PageHelioCatalog extends PageController(
  "catalog",
  {
    displayName: "$helio.catalog.page.name",
    description: "$helio.catalog.page.description",
    icon: "i-ph-package",
    category: helioSalesCategory,
    order: 3,
  },
  DefaultLayout({ fullWidth: true }),
) {
  static stats = StatGroup({
    layout: "cards",
    columns: 4,
    fetchUrl: pageRoutePath(PAGE_SLUG, "/stats"),
  });

  static table = TableView(productController, productTableOptions);

  static categories = TableView(
    productCategoryController,
    categoryTableOptions,
  );

  /** Read again on every visit: the figures follow the edits made below. */
  @Get("/stats")
  async catalogStats() {
    const [products, categories] = await Promise.all([
      GetModel(ProductModel).getAll(),
      GetModel(ProductCategoryModel).getAll(),
    ]);
    return {
      items: catalogStats(products, categories, {
        active: tableViewLink(PageHelioCatalog, "table", { view: "active" }),
        toReorder: tableViewLink(PageHelioCatalog, "table", {
          view: "to-reorder",
        }),
      }),
    };
  }
}
