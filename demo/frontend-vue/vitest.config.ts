import { testTimeouts } from "@antelopejs/tooling-configs/vitest";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * The tests compile without `tsconfig.json`, which extends the types only
 * `pnpm lint` writes to `.dms-types`.
 */
const TESTS_TSCONFIG = "{}";

export default defineConfig({
  plugins: [vue()],
  esbuild: { tsconfigRaw: TESTS_TSCONFIG },
  test: {
    ...testTimeouts,
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
