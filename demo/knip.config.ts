import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

export default antelopeKnipConfig({
  /**
   * `src/home.ts` is an entry point: decorators register the pages at import time and nothing
   * imports the classes themselves, so without it every page reads as a dead export.
   */
  entry: ["src/home.ts"],
  /** `frontend-vue` is its own workspace package of the root `pnpm-workspace.yaml`. */
  ignore: ["frontend-vue/**"],
});
