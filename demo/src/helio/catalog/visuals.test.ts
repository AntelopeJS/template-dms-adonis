import assert from "node:assert";
import { describe, it } from "node:test";
import { renderProductVisual } from "./visuals";

const SKU = "SKU-1";
const INHERITED_NAMES = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
];

void describe("renderProductVisual", () => {
  void it("draws the pictogram of a known family", () => {
    const panels = renderProductVisual("cat-panels", SKU);
    assert.notStrictEqual(panels, renderProductVisual("cat-services", SKU));
    assert.match(panels, /SKU-1/);
  });

  void it("draws the services art for an unknown family", () => {
    assert.strictEqual(
      renderProductVisual("foo", SKU),
      renderProductVisual("cat-services", SKU),
    );
  });

  void it("draws the services art for a family named like an Object member", () => {
    const services = renderProductVisual("cat-services", SKU);
    for (const name of INHERITED_NAMES) {
      assert.strictEqual(renderProductVisual(name, SKU), services, name);
    }
  });
});
