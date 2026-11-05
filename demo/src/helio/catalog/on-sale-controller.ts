import { Controller, type ControllerClass } from "@antelopejs/interface-api";
import {
  DataController,
  DefaultRoutes,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  type FilterValue,
  Listable,
  ModelReference,
} from "@antelopejs/interface-data-api/metadata";
import { Model } from "@antelopejs/interface-database-decorators";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import {
  Column,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { Product, ProductModel } from "./database";

/**
 * The route filter of the products on sale: it is mandatory, so the select
 * route only ever lists the active products.
 */
const ON_SALE_ONLY = {
  isActive: ["true", "is"],
} satisfies Record<string, FilterValue>;

/**
 * The products on sale, for the "Product" picker of the quote lines: the same
 * helio_products rows, so a product added to the catalog shows up there at
 * once and a discontinued one can no longer be quoted. Not exported on
 * purpose (TS2742, see product-controller.ts).
 */
@RegisterDataController()
class onSaleProductDataAPI extends DataController(
  Product,
  {
    get: TableViewRoutes.Get,
    select: DefaultRoutes.WithOptions(TableViewRoutes.Select, {
      filters: ON_SALE_ONLY,
    }),
  },
  Controller("/api/helio/catalog/products-on-sale"),
) {
  @ModelReference()
  @Model(ProductModel)
  declare model: ProductModel;

  @Select()
  @Listable()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.name",
    type: new DefaultDataTypes.StringType(),
  })
  @Access(AccessMode.ReadOnly)
  declare name: string;

  @Searchable()
  @Select()
  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.sku",
    type: new DefaultDataTypes.StringType(),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare sku: string;

  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.isActive",
    type: new DefaultDataTypes.BooleanType(),
    filterable: true,
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare isActive: boolean;
}

/** ControllerClass-typed alias of `onSaleProductDataAPI` for the quote lines (see the TS2742 note). */
export type OnSaleProductRow = {
  [Field in keyof onSaleProductDataAPI]: onSaleProductDataAPI[Field];
};

export const onSaleProductController: ControllerClass<OnSaleProductRow> =
  onSaleProductDataAPI;
