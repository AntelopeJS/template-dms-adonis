import {
  Controller,
  type ControllerClass,
  Parameter,
  type RequestContext,
} from "@antelopejs/interface-api";
import {
  DataController,
  type DataControllerCallback,
  type DataControllerCallbackWithOptions,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import type { Parameters } from "@antelopejs/interface-data-api/components";
import {
  Access,
  AccessMode,
  Listable,
  Mandatory,
  ModelReference,
  ModifierKey,
  Optional,
  Sortable,
} from "@antelopejs/interface-data-api/metadata";
import {
  LocalizationModifier,
  Model,
} from "@antelopejs/interface-database-decorators";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import {
  Column,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { countCategoryProducts } from "./category-usage";
import { ProductCategory, ProductCategoryModel } from "./database";

/**
 * A request without a language (a call made on the server) reads and
 * searches the English names: searching a localized field in no language
 * failed with a 500 ($getField of a null field).
 */
function contentLanguageOf(header: string | undefined): string {
  return header || "en";
}

/**
 * The top-level families only, for the parent picker of a category: a
 * category tree stays two levels deep. Read-only, select route only.
 */
@RegisterDataController()
class productFamilyDataAPI extends DataController(
  ProductCategory,
  { select: TableViewRoutes.Select },
  Controller("/api/helio/product-families"),
) {
  @ModelReference()
  @Model(ProductCategoryModel)
  declare model: ProductCategoryModel;

  @Parameter("x-content-language", "header")
  declare contentLanguage: string | undefined;

  @ModifierKey(LocalizationModifier)
  get language(): string {
    return contentLanguageOf(this.contentLanguage);
  }

  @Select()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Select()
  @Column({
    name: "$helio.catalog.categories.columns.name",
    type: new DefaultDataTypes.StringType(),
  })
  @Access(AccessMode.ReadOnly)
  declare name: string;

  @Select()
  @Column({
    name: "$helio.catalog.categories.columns.parent",
    type: new DefaultDataTypes.StringType(),
  })
  @Access(AccessMode.ReadOnly)
  declare parent: string;
}

/**
 * The `select` route without the relation joins: it answers each range's
 * parent as its raw id, which the products' CascaderRelationType rebuilds
 * the tree from. The list, the get and the forms read the parent joined.
 */
function withRawParent(
  route: DataControllerCallbackWithOptions,
): DataControllerCallbackWithOptions {
  const callback: DataControllerCallback = route.callback;
  return {
    ...route,
    callback: {
      ...callback,
      func: function (
        this: unknown,
        ctx: RequestContext,
        params: Parameters.ListParameters | undefined,
        ...rest: unknown[]
      ) {
        const result: unknown = callback.func.call(
          this,
          ctx,
          { ...params, noForeign: true },
          ...rest,
        );
        return result;
      },
    },
  };
}

/**
 * The data API of the product categories, behind the category table and the
 * product forms. Not exported on purpose: emitting a .d.ts for this class
 * would require naming types from the nested @antelopejs/interface-core
 * copies (TS2742), so `productCategoryController` is exported instead.
 */
@RegisterDataController()
class productCategoryDataAPI extends DataController(
  ProductCategory,
  {
    ...TableViewRoutes.All,
    select: withRawParent(TableViewRoutes.Select),
  },
  Controller("/api/helio/product-categories"),
) {
  @ModelReference()
  @Model(ProductCategoryModel)
  declare model: ProductCategoryModel;

  /**
   * Localized names are read and written in the caller's language; forms ask
   * with "*" and get every language at once.
   */
  @Parameter("x-content-language", "header")
  declare contentLanguage: string | undefined;

  @ModifierKey(LocalizationModifier)
  get language(): string {
    return contentLanguageOf(this.contentLanguage);
  }

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable({ noIndex: true })
  @Exported()
  @Column({
    name: "$helio.catalog.categories.columns.name",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.catalog.categories.placeholders.name",
      maxLength: 60,
    }),
    filterable: true,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare name: string;

  /**
   * Self-reference: the list joins the parent family (`Foreign`), so a row
   * names it without a read of its own; the `select` route keeps the raw id
   * (withRawParent), which the products' CascaderRelationType rebuilds the
   * tree from. The filter still runs on the stored id.
   */
  @Select()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.categories.columns.parent",
    type: new DefaultDataTypes.CascaderRelationType({
      dataApiController: productFamilyDataAPI,
      keyMapping: { label: "name", value: "_id", parent: "parent" },
      maxDepth: 1,
      deselectable: true,
      placeholder: "$helio.catalog.categories.placeholders.parent",
    }),
    filterable: true,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare parent: string;

  /**
   * Products filed under the category, or under the ranges of a family.
   * Read by a getter and not a database `@Computed`: the DMS list route
   * leaves out a computed field the request neither filters nor sorts on.
   */
  @Listable(["_id", "parent"])
  @Column({
    name: "$helio.catalog.categories.columns.productCount",
    readonlyBehavior: ReadonlyBehaviorType.hidden,
    type: new DefaultDataTypes.NumberType({ min: 0 }),
    validate: false,
    size: 120,
  })
  @Access(AccessMode.ReadOnly)
  get productCount(): Promise<number> {
    return countCategoryProducts(this.table._id, !this.table.parent);
  }
}

/** ControllerClass-typed alias of `productCategoryDataAPI` for the products' CascaderRelationType and the catalog pages (see the TS2742 note above). */
export type ProductCategoryRow = {
  [Field in keyof productCategoryDataAPI]: productCategoryDataAPI[Field];
};

export const productCategoryController: ControllerClass<ProductCategoryRow> =
  productCategoryDataAPI;
