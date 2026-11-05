import assert from "node:assert";
import { describe, it } from "node:test";
import { regionOfProvince } from "./regions";

const INHERITED_NAMES = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
];

void describe("regionOfProvince", () => {
  void it("maps each province of the table", () => {
    assert.strictEqual(regionOfProvince("Liège"), "liege");
    assert.strictEqual(regionOfProvince("Hainaut"), "hainaut");
    assert.strictEqual(regionOfProvince("Brabant wallon"), "brussels");
  });

  void it("falls back to Liège for a missing or unknown province", () => {
    assert.strictEqual(regionOfProvince(undefined), "liege");
    assert.strictEqual(regionOfProvince(""), "liege");
    assert.strictEqual(regionOfProvince("Flandre"), "liege");
  });

  void it("falls back to Liège for a province named like an Object member", () => {
    for (const name of INHERITED_NAMES) {
      assert.strictEqual(regionOfProvince(name), "liege", name);
    }
  });
});
