import { defineConfig } from "oxlint";
import {
  ANTELOPE_IGNORE_PATTERNS,
  antelopePreset,
} from "@antelopejs/tooling-configs/oxc/lint";

/**
 * Lints the module and its Vue frontend (`.ts` and `.vue` script blocks); type-aware rules read
 * `frontend-vue/tsconfig.json` there. ESLint still runs the Vue template rules (`pnpm --dir frontend-vue lint`).
 */
export default defineConfig({
  extends: [antelopePreset({ importSorting: false })],
  ignorePatterns: ANTELOPE_IGNORE_PATTERNS,
});
