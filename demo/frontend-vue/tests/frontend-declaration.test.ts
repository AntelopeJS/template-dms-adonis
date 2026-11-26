import { resolve } from "node:path";
import { expect, it } from "vitest";
import projectPackage from "../../package.json";
import { frontendModule } from "../../src/frontend-module";
import frontendPackage from "../package.json";

it("declares the frontend module the renderer reads, in package.json", () => {
  expect(
    projectPackage.dmsFrontend,
    "ajs dms dev, build and start leave out, with a warning only, a frontend package.json does not declare as dmsFrontend",
  ).toBe("dist/frontend-module.js");
  expect(frontendModule()).toMatchObject({
    name: frontendPackage.name,
    sourcePath: resolve(import.meta.dirname, ".."),
    renderer: { name: "vue", version: "3" },
  });
});
