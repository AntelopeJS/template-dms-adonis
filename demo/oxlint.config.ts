import { defineConfig } from "oxlint";
import {
  ANTELOPE_IGNORE_PATTERNS,
  antelopePreset,
} from "@antelopejs/tooling-configs/oxc/lint";

/**
 * Lints the module and its Vue frontend: `.ts` files with every rule, typed by
 * `frontend-vue/tsconfig.json`, and `.vue` script blocks with the rules that need no types.
 * ESLint still runs the Vue template rules (`pnpm --dir frontend-vue lint`).
 */
export default defineConfig({
  extends: [antelopePreset({ importSorting: false })],
  ignorePatterns: ANTELOPE_IGNORE_PATTERNS,
});
