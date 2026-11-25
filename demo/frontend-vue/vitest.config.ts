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
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
