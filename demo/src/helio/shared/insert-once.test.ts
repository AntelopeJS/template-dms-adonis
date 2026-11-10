import assert from "node:assert";
import { describe, it } from "node:test";
import { insertOnce } from "./insert-once";

interface Row {
  _id: string;
}

function memoryTable(stored: Map<string, Row>) {
  return {
    get: (id: string) => Promise.resolve(stored.get(id)),
  };
}

const duplicate = new Error("E11000 duplicate key");

void describe("insertOnce", () => {
  void it("answers true when the insert writes the row", async () => {
    const stored = new Map<string, Row>();
    const table = memoryTable(stored);
    const wrote = await insertOnce(table, "row", () => {
      stored.set("row", { _id: "row" });
      return Promise.resolve(["row"]);
    });
    assert.strictEqual(wrote, true);
    assert.deepStrictEqual([...stored.keys()], ["row"]);
  });

  void it("answers false when another replica stored the row first", async () => {
    const table = memoryTable(new Map([["row", { _id: "row" }]]));
    let attempts = 0;
    const wrote = await insertOnce(table, "row", () => {
      attempts++;
      return Promise.reject(duplicate);
    });
    assert.strictEqual(wrote, false);
    assert.strictEqual(attempts, 1);
  });

  void it("rethrows the insert's error when the row is still missing", async () => {
    const table = memoryTable(new Map([["other", { _id: "other" }]]));
    await assert.rejects(
      insertOnce(table, "row", () => Promise.reject(duplicate)),
      duplicate,
    );
  });
});
