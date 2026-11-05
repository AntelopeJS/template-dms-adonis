import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, it } from "node:test";

const DEFAULTS = join(__dirname, "defaults.js");
const KEY = /^hk_live_[0-9a-f]{40}$/;

function seededKey(env: Record<string, string>): string {
  const { HELIO_NOW: _unset, ...inherited } = process.env;
  return execFileSync(
    process.execPath,
    [
      "-e",
      `console.log(require(${JSON.stringify(DEFAULTS)}).buildDefaultSettings().apiKey)`,
    ],
    { env: { ...inherited, ...env }, encoding: "utf8" },
  ).trim();
}

void describe("the seeded API key", () => {
  void it("is the same on every run when HELIO_NOW fixes the instant", () => {
    const env = { HELIO_NOW: "2026-06-15T09:00:00Z" };
    const first = seededKey(env);
    assert.match(first, KEY);
    assert.strictEqual(seededKey(env), first);
    assert.notStrictEqual(
      seededKey({ HELIO_NOW: "2026-06-16T09:00:00Z" }),
      first,
    );
  });

  void it("is random on every run otherwise", () => {
    const first = seededKey({});
    assert.match(first, KEY);
    assert.notStrictEqual(seededKey({}), first);
  });
});
