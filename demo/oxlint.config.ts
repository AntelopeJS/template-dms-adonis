import { defineConfig } from "oxlint";
import {
  ANTELOPE_IGNORE_PATTERNS,
  antelopePreset,
} from "@antelopejs/tooling-configs/oxc/lint";

/** ESLint lints the Vue frontend module (`pnpm --dir frontend-vue lint`). */
export default defineConfig({
  extends: [antelopePreset({ importSorting: false })],
  ignorePatterns: [...ANTELOPE_IGNORE_PATTERNS, "frontend-vue/**"],
  options: { typeAware: true, maxWarnings: 0 },
});
