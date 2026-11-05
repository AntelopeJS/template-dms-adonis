import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { Product, ProductCategory } from "./database";
import { SERVICES_FAMILY } from "./options";

const CENTS = 100;

/** Views of the catalog table the figures lead to, built by the page. */
export interface CatalogStatLinks {
  active: string;
  toReorder: string;
}

const isStocked = (product: Product): boolean =>
  product.stock !== undefined && product.stockMin !== undefined;

const isLow = (product: Product): boolean =>
  isStocked(product) &&
  (product.stockMin ?? 0) > 0 &&
  (product.stock ?? 0) < (product.stockMin ?? 0);

const marginOf = ({ price, cost }: Product): number =>
  price ? (price - cost) / price : 0;

/**
 * A product's family is the parent of its range (a product filed straight
 * under a family belongs to it), the way the catalog views read it.
 */
function familyOf(
  product: Product,
  parents: ReadonlyMap<string, string | undefined>,
): string {
  return parents.get(product.category) ?? product.category;
}

function onSaleItem(
  products: Product[],
  parents: ReadonlyMap<string, string | undefined>,
  links: CatalogStatLinks,
) {
  const onSale = products.filter((product) => product.isActive);
  const services = onSale.filter(
    (product) => familyOf(product, parents) === SERVICES_FAMILY,
  ).length;
  return {
    id: "on-sale",
    icon: "i-ph-storefront",
    eyebrow: "$helio.catalog.stats.onSale",
    value: onSale.length,
    detail: {
      key: "$helio.catalog.stats.onSaleDetail",
      params: {
        hardware: { type: "count", value: onSale.length - services },
        services: { type: "count", value: services },
      },
    },
    to: links.active,
  } satisfies StatGroupItem;
}

function stockValueItem(products: Product[]) {
  const stocked = products.filter(isStocked);
  const value = stocked.reduce(
    (sum, product) => sum + (product.stock ?? 0) * product.cost,
    0,
  );
  const units = stocked.reduce((sum, product) => sum + (product.stock ?? 0), 0);
  return {
    id: "stock-value",
    icon: "i-ph-warehouse",
    eyebrow: "$helio.catalog.stats.stockValue",
    value: {
      key: "$helio.catalog.stats.amount",
      params: {
        amount: {
          type: "money",
          value: Math.round(value * CENTS),
          currency: "EUR",
        },
      },
    },
    detail: {
      key: "$helio.catalog.stats.stockValueDetail",
      params: { units: { type: "count", value: units } },
    },
  } satisfies StatGroupItem;
}

function toReorderItem(products: Product[], links: CatalogStatLinks) {
  const low = products.filter((product) => product.isActive && isLow(product));
  return {
    id: "to-reorder",
    icon: "i-ph-warning",
    tone: low.length > 0 ? "error" : "success",
    eyebrow: "$helio.catalog.stats.toReorder",
    value: low.length,
    detail:
      low.length > 0
        ? {
            key: "$helio.catalog.stats.toReorderDetail",
            params: { names: low.map((product) => product.name).join(", ") },
          }
        : "$helio.catalog.stats.toReorderNone",
    detailTone: low.length > 0 ? "error" : "success",
    to: links.toReorder,
  } satisfies StatGroupItem;
}

function marginItem(products: Product[]) {
  const hardware = products.filter(
    (product) => product.isActive && isStocked(product),
  );
  const average =
    hardware.reduce((sum, product) => sum + marginOf(product), 0) /
    Math.max(hardware.length, 1);
  return {
    id: "margin",
    icon: "i-ph-chart-line-up",
    eyebrow: "$helio.catalog.stats.margin",
    value: {
      key: "$helio.catalog.stats.percent",
      params: { value: { type: "number", value: average, format: "percent" } },
    },
    detail: "$helio.catalog.stats.marginDetail",
  } satisfies StatGroupItem;
}

/**
 * The figures above the catalog, computed from the products on every visit so
 * they follow each edit: what is on sale, what the warehouse is worth, what
 * must be reordered and the margin hardware leaves.
 */
export function catalogStats(
  products: Product[],
  categories: ProductCategory[],
  links: CatalogStatLinks,
): StatGroupItem[] {
  const parents = new Map(
    categories.map((category) => [category._id, category.parent]),
  );
  return [
    onSaleItem(products, parents, links),
    stockValueItem(products),
    toReorderItem(products, links),
    marginItem(products),
  ];
}
