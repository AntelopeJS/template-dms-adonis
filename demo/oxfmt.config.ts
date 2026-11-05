import { antelopeFmtPreset } from "@antelopejs/tooling-configs/oxc/fmt";

/** Prettier formats the Vue frontend module; Markdown was never machine-formatted here. */
export default antelopeFmtPreset({
  ignorePatterns: ["frontend-vue/**", "**/*.md", "**/*.vue"],
});
