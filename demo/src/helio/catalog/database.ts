import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  LocalizationModifier,
  Localized,
  RegisterTable,
  Relation,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import type { ProductRosterEntry } from "../shared/roster";
import { buildProductCategories, buildProducts } from "./fixtures";

export const CATEGORIES_TABLE = "helio_product_categories";
export const PRODUCTS_TABLE = "helio_products";

export type ProductUnit = ProductRosterEntry["unit"];

/**
 * Options for the localized fields: each stores one value per interface
 * language ({ en, fr }), and a language without a value reads the English one.
 */
const LOCALIZED = { fallbackLocale: "en" };

/**
 * Two-level product tree (family → range), read by a CascaderRelationType. The
 * fixture writes the whole { en, fr } record of each localized field.
 */
@RegisterTable(CATEGORIES_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() =>
  buildProductCategories().map((row) =>
    ProductCategoryModel.fromPlainData(row).localize("*"),
  ),
)
export class ProductCategory extends Table.with(LocalizationModifier) {
  @Field("string") declare _id: string;

  @Localized(LOCALIZED) @Field("string") declare name: string;
  @Index()
  @Field("string")
  @Relation({ to: () => ProductCategory })
  declare parent?: string;
}

export class ProductCategoryModel extends BasicDataModel(
  ProductCategory,
  CATEGORIES_TABLE,
) {}

/** What Helio sells: hardware from PRODUCT_ROSTER and its services. */
@RegisterTable(PRODUCTS_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() =>
  buildProducts().map((row) => ProductModel.fromPlainData(row).localize("*")),
)
export class Product extends Table.with(LocalizationModifier) {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare sku: string;
  @Field("string") declare name: string;
  @Localized(LOCALIZED) @Field("string") declare description?: string;
  @Index()
  @Field("string")
  @Relation({ to: () => ProductCategory })
  declare category: string;
  /** Unit price excluding VAT, in euros. */
  @Field("number") declare price: number;
  /** Purchase cost excluding VAT, in euros. */
  @Field("number") declare cost: number;
  /** Peak power (W) for panels and inverters, capacity (Wh) for batteries, absent for services. */
  @Field("number") declare power?: number;
  @Field("string") declare unit: ProductUnit;
  /** Units in the warehouse; absent for services. */
  @Field("number") declare stock?: number;
  /** Reorder threshold; absent for services. */
  @Field("number") declare stockMin?: number;
  /** An image URL: by default the product visual the backend draws (visuals.ts). */
  @Field("string") declare image?: string;
  @Field(["string"]) declare tags: string[];
  @Index() @Field("boolean") declare isActive: boolean;
  @Index() @Field("number") declare displayOrder: number;
  @Field("number") declare warrantyYears: number;
}

export class ProductModel extends BasicDataModel(Product, PRODUCTS_TABLE) {}
