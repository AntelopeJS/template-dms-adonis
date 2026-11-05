import {
  Controller,
  type ControllerClass,
  Parameter,
} from "@antelopejs/interface-api";
import {
  DataController,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  Computed,
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
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import {
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";
import type { CellSubline } from "@antelopejs/interface-dms/base/table-view/column-display";
import { productCategoryController } from "./category-controller";
import { CATEGORIES_TABLE, Product, ProductModel } from "./database";
import {
  FORMS_ONLY_VIEW,
  LOW_STOCK_MARGIN,
  PRODUCT_FAMILIES,
  PRODUCT_TAGS,
  PRODUCT_UNITS,
  STOCK_LEVELS,
  type StockLevel,
} from "./options";

/**
 * The data API of the products, behind every table, picker and form that
 * reads them. Not exported on purpose: emitting a .d.ts for this class would
 * require naming types from the nested @antelopejs/interface-core copies
 * (TS2742), so `productController` is exported instead.
 */
@RegisterDataController()
class productDataAPI extends DataController(
  Product,
  TableViewRoutes.All,
  Controller("/api/helio/products"),
) {
  @ModelReference()
  @Model(ProductModel)
  declare model: ProductModel;

  /**
   * The language the localized description is read and written in. Forms
   * ask for "*" and get every language at once.
   */
  @Parameter("x-content-language", "header")
  @ModifierKey(LocalizationModifier)
  declare language: string;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.name",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.catalog.products.placeholders.name",
      maxLength: 80,
    }),
    filterable: true,
    size: 280,
    display: new DefaultDisplays.IdentityDisplay({
      avatarField: "image",
      subtitleField: "sku",
      badges: [
        {
          field: "isActive",
          equals: false,
          label: "$helio.catalog.products.badges.inactive",
          tone: "neutral",
        },
      ],
    }),
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare name: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.sku",
    type: new DefaultDataTypes.StringType({
      placeholder: "PV-MONO-410",
      maxLength: 24,
    }),
    filterable: true,
    display: new DefaultDisplays.MonoDisplay({ copy: true }),
    size: 150,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare sku: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.category",
    type: new DefaultDataTypes.CascaderRelationType({
      dataApiController: productCategoryController,
      keyMapping: { label: "name", value: "_id", parent: "parent" },
      leafOnly: true,
      placeholder: "$helio.catalog.products.placeholders.category",
    }),
    filterable: true,
    size: 220,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare category: string;

  /**
   * The family is the parent of the product's range, read in the database
   * from helio_product_categories: the views and the quick filter narrow on
   * the families instead of every range, without a stored copy that could
   * drift when a range moves. Hidden by default: the list route answers it
   * whenever the Columns menu shows it (Query.ListPage, interface-data-api#43).
   */
  @Listable()
  @Sortable()
  @Computed(
    (row, db) =>
      db
        .table(CATEGORIES_TABLE)
        .get(row.key("category").cast<string>())
        .key("parent"),
    { default: null },
  )
  @Column({
    name: "$helio.catalog.products.columns.family",
    readonlyBehavior: FORMS_ONLY_VIEW,
    type: new DefaultDataTypes.SelectType({ items: [...PRODUCT_FAMILIES] }),
    filterable: true,
    validate: false,
    size: 170,
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare family: string;

  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.description",
    type: new DefaultDataTypes.StringType({
      textarea: true,
      rows: 3,
      maxLength: 300,
      showCount: true,
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare description: string;

  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.price",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 120,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare price: number;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.cost",
    type: new DefaultDataTypes.PriceType(),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare cost: number;

  /**
   * Gross margin on the price, computed on read and not stored. It is null
   * without a price or a cost.
   */
  @Listable(["price", "cost"])
  @Column({
    name: "$helio.catalog.products.columns.margin",
    readonlyBehavior: FORMS_ONLY_VIEW,
    type: new DefaultDataTypes.PercentageType(),
    validate: false,
    size: 110,
  })
  @Access(AccessMode.ReadOnly)
  get margin(): number | null {
    const { price, cost } = this.table;
    if (!price || cost === undefined) return null;
    return Math.round(((price - cost) / price) * 1000) / 1000;
  }

  /**
   * Peak power (W) or capacity (Wh). A service has none, so the column shows a
   * dash instead of a number.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.power",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 1,
      suffix: "$helio.catalog.products.powerSuffix",
      width: "compact",
      fallback: "—",
    }),
    filterable: true,
    isVisible: false,
    size: 120,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare power: number;

  @Select()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.unit",
    type: new DefaultDataTypes.SelectType({ items: [...PRODUCT_UNITS] }),
    filterable: true,
    defaultValue: "piece",
    size: 110,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare unit: string;

  /**
   * Units in the warehouse. The grid shows them over the reorder threshold,
   * toned by how close the stock is to it (`stockStatus`).
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.stock",
    description: "$helio.catalog.products.stockHint",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 1,
      width: "compact",
    }),
    filterable: true,
    display: new DefaultDisplays.TwoLineDisplay({
      subField: "stockStatus",
      emptyLabel: "$helio.catalog.products.stock.notStocked",
    }),
    size: 130,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare stock: number;

  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.stockMin",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 1,
      width: "compact",
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare stockMin: number;

  /**
   * Whether the stock is below the reorder threshold, computed in the
   * database so a view or a quick filter can list the products to reorder.
   * Hidden: `stockLevel` says the same with more nuance, in the grid and on
   * the cards.
   */
  @Listable()
  @Computed(
    (row) => {
      const threshold = row.key("stockMin").default(0);
      return threshold.gt(0).and(row.key("stock").default(0).lt(threshold));
    },
    { default: false },
  )
  @Column({
    name: "$helio.catalog.products.columns.lowStock",
    readonlyBehavior: ReadonlyBehaviorType.hidden,
    type: new DefaultDataTypes.BooleanType(),
    filterable: true,
    validate: false,
    display: new DefaultDisplays.IndicatorDisplay({
      onLabel: "$helio.catalog.products.stock.low",
      offLabel: "$helio.catalog.products.stock.ok",
      onIcon: "i-ph-warning",
      offIcon: "i-ph-check-circle",
      onTone: "error",
      offTone: "success",
    }),
    isVisible: false,
    size: 130,
  })
  @Access(AccessMode.ReadOnly)
  declare lowStock: boolean;

  /**
   * A plain text and not a UrlType: the seeded visuals are paths on the
   * dashboard's own origin (/api/helio/catalog-visuals/…), which a URL check
   * refuses. Not an ImageType either: its values are uploads the DMS tracks,
   * which a fixture cannot create.
   */
  @Select()
  @Listable()
  @Column({
    name: "$helio.catalog.products.columns.image",
    description: "$helio.catalog.products.imageHint",
    type: new DefaultDataTypes.StringType({
      placeholder: "https://…",
      maxLength: 500,
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare image: string;

  /**
   * The same picture typed as an image, for the cards display: a card field
   * renders through its column's data type and ignores `display`, so the
   * name column's avatar never reaches a card. The image type draws a URL
   * string as an avatar. Read-only: forms keep editing `image`.
   */
  @Listable(["image"])
  @Column({
    name: "$helio.catalog.products.columns.picture",
    readonlyBehavior: ReadonlyBehaviorType.hidden,
    type: new DefaultDataTypes.ImageType(),
    validate: false,
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  get picture(): string | null {
    return this.table.image ?? null;
  }

  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.tags",
    type: new DefaultDataTypes.TagsType({
      max: 6,
      suggestions: PRODUCT_TAGS,
      placeholder: "$helio.catalog.products.placeholders.tags",
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare tags: string[];

  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.warrantyYears",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      max: 30,
      step: 1,
      suffix: "$helio.catalog.products.yearsSuffix",
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare warrantyYears: number;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.catalog.products.columns.isActive",
    type: new DefaultDataTypes.BooleanType({
      label: "$helio.catalog.products.activeSwitch",
    }),
    filterable: true,
    defaultValue: true,
    display: new DefaultDisplays.IndicatorDisplay({
      onLabel: "$helio.catalog.products.active",
      offLabel: "$helio.catalog.products.badges.inactive",
    }),
    size: 110,
  })
  @Access(AccessMode.ReadWrite)
  declare isActive: boolean;

  /** The position a hand-ordered catalog (`reorder`) saves. */
  @Listable()
  @Sortable()
  @Column({
    name: "$helio.catalog.products.columns.displayOrder",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 1,
      width: "compact",
    }),
    defaultValue: 999,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare displayOrder: number;

  /**
   * Where the stock stands against its threshold, as a select so it reads the
   * same on the cards (which draw a column's data type, not its display) as
   * in the grid (a toned pill). A stock at or above the threshold but under
   * `LOW_STOCK_MARGIN` times it reads "running_low".
   */
  @Listable(["stock", "stockMin"])
  @Column({
    name: "$helio.catalog.products.columns.stockLevel",
    readonlyBehavior: FORMS_ONLY_VIEW,
    type: new DefaultDataTypes.SelectType({ items: [...STOCK_LEVELS] }),
    validate: false,
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        in_stock: "success",
        running_low: "warning",
        reorder: "error",
        not_stocked: "neutral",
      },
    }),
    size: 140,
  })
  @Access(AccessMode.ReadOnly)
  get stockLevel(): StockLevel {
    const { stock, stockMin } = this.table;
    if (stock === undefined) return "not_stocked";
    if (!stockMin) return "in_stock";
    if (stock < stockMin) return "reorder";
    return stock < stockMin * LOW_STOCK_MARGIN ? "running_low" : "in_stock";
  }

  /**
   * The line under the stock: the reorder threshold, with the error tone once
   * the stock fell below it and the warning tone when it is under
   * `LOW_STOCK_MARGIN` times it. It is null for a product without a stock or a threshold.
   */
  @Listable(["stock", "stockMin"])
  @Access(AccessMode.ReadOnly)
  get stockStatus(): CellSubline | null {
    const { stock, stockMin } = this.table;
    if (stock === undefined || !stockMin) return null;
    const params = { min: stockMin };
    if (stock < stockMin) {
      return {
        text: { key: "$helio.catalog.products.stock.belowMin", params },
        tone: "error",
      };
    }
    return {
      text: { key: "$helio.catalog.products.stock.min", params },
      tone: stock < stockMin * LOW_STOCK_MARGIN ? "warning" : "muted",
    };
  }
}

/** ControllerClass-typed alias of `productDataAPI` for quote lines, project pages and the catalog (see the TS2742 note above). */
export type ProductRow = {
  [Field in keyof productDataAPI]: productDataAPI[Field];
};

export const productController: ControllerClass<ProductRow> = productDataAPI;
