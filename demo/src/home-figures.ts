import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getRegisteredRoutes } from "@antelopejs/interface-api";
import { getTablesForSchema } from "@antelopejs/interface-database-decorators";
import { GetFrontendModules } from "@antelopejs/interface-dms/page";
import { DEMO_SCHEMA_NAME } from "./schema";

/** What the home page's figures show. */
export interface HomeFigures {
  /** Helio pages of the menu. */
  menuPages: number;
  /** Helio pages opened from a record or a button: a project's detail, the
   * generated form pages of a table. */
  detailPages: number;
  collections: number;
  dataControllers: number;
  /** `CustomComponent(…)` calls in the compiled Helio code. */
  customBlocks: number;
  modules: number;
}

/** Every page serves its layout at /dms/pages/<slug>/pagelayout. */
const HELIO_LAYOUT = /^\/dms\/pages\/helio\/(.+)\/pagelayout$/;
/** Every data controller of TableViewRoutes answers /api/helio/<name>/list. */
const HELIO_LIST = /^\/api\/helio\/([^/]+)\/list$/;
/** How a compiled module calls the CustomComponent factory. */
const CUSTOM_CALL = /\.CustomComponent\)\(/g;
/** The feature modules' frontend layers: @antelopejs/dms-<feature>-frontend-*. */
const FEATURE_LAYER = /^@antelopejs\/dms-([a-z-]+?)-frontend/;

/**
 * Counts the Helio pages from their layout routes. A detail page takes the
 * record in its path (`project/:id`) and a table's generated form pages sit under
 * it (`quotes/table/new`); every other page is a menu page.
 */
function helioPages() {
  const slugs = new Set<string>();
  for (const route of getRegisteredRoutes()) {
    const match = HELIO_LAYOUT.exec(route.location);
    if (match?.[1]) slugs.add(match[1]);
  }
  const detail = [...slugs].filter(
    (slug) => slug.includes(":") || slug.includes("/table/"),
  ).length;
  return { menu: slugs.size - detail, detail };
}

function dataControllers(): number {
  const names = new Set<string>();
  for (const route of getRegisteredRoutes()) {
    const match = HELIO_LIST.exec(route.location);
    if (match?.[1]) names.add(match[1]);
  }
  return names.size;
}

function collections(): number {
  return Object.keys(getTablesForSchema(DEMO_SCHEMA_NAME) ?? {}).filter(
    (name) => name.startsWith("helio_"),
  ).length;
}

/** Counts the `CustomComponent` calls in the compiled Helio folder, which sits next to this file (dist/helio). */
function customBlocks(dir = path.join(__dirname, "helio")): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) count += customBlocks(file);
    else if (entry.name.endsWith(".js"))
      count += readFileSync(file, "utf8").match(CUSTOM_CALL)?.length ?? 0;
  }
  return count;
}

async function featureModules(): Promise<number> {
  const layers = await GetFrontendModules();
  const features = new Set<string>();
  for (const layer of layers) {
    const match = FEATURE_LAYER.exec(layer.name);
    if (match?.[1]) features.add(match[1]);
  }
  return features.size;
}

/**
 * The home page's figures, counted at runtime from what this module really
 * registered rather than typed by hand: the Helio pages (their layout routes),
 * the collections of the demo schema, the data controllers (their generated list
 * routes), the custom Vue blocks in the compiled Helio code, and the frontend
 * layers of the installed DMS modules.
 */
export async function homeFigures(): Promise<HomeFigures> {
  const pages = helioPages();
  return {
    menuPages: pages.menu,
    detailPages: pages.detail,
    collections: collections(),
    dataControllers: dataControllers(),
    customBlocks: customBlocks(),
    modules: await featureModules(),
  };
}
