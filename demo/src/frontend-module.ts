import path from "node:path";
import type { AddFrontendModuleOptions } from "@antelopejs/interface-dms/page";

/**
 * This template's frontend module, from its configuration alone: `construct()`
 * registers it with `AddFrontendModule`, and `ajs dms build` calls this same
 * function (declared as `dmsFrontend` in package.json) to build the frontend
 * from the project, without a backend. Its `dmsI18nAppLayer` option makes the
 * language files (helio-*, demo-*) the editable "Project files" of dms-lang's
 * Translations.
 */
export function frontendModule(): AddFrontendModuleOptions {
  return {
    name: "template-dms-demo-frontend-vue",
    sourcePath: path.join(__dirname, "../frontend-vue"),
    renderer: { name: "vue", version: "3" },
    priority: 100,
    options: { dmsI18nAppLayer: true },
  };
}
