import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, it } from "node:test";

const CLOCK = join(__dirname, "clock.js");
const INSTANT = "2026-06-15T09:00:00Z";

function evaluate(expression: string, env: Record<string, string>): string {
  const { HELIO_NOW: _unset, ...inherited } = process.env;
  return execFileSync(
    process.execPath,
    [
      "-e",
      `const clock = require(${JSON.stringify(CLOCK)}); console.log(${expression})`,
    ],
    { env: { ...inherited, ...env }, encoding: "utf8", stdio: "pipe" },
  ).trim();
}

function readClock(env: Record<string, string>): string {
  return evaluate("clock.helioNow()", env);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

void describe("helioNow", () => {
  void it("answers the HELIO_NOW instant, whenever it is read", () => {
    const first = readClock({ HELIO_NOW: INSTANT });
    assert.strictEqual(first, String(Date.parse(INSTANT)));
    assert.strictEqual(readClock({ HELIO_NOW: INSTANT }), first);
  });

  void it("answers the real time when HELIO_NOW is unset or empty", () => {
    const environments: Record<string, string>[] = [{}, { HELIO_NOW: "" }];
    for (const env of environments) {
      const before = Date.now();
      const read = Number(readClock(env));
      assert.ok(read >= before && read <= Date.now(), JSON.stringify(env));
    }
  });

  void it("refuses a HELIO_NOW that is not an instant", () => {
    assert.throws(
      () => readClock({ HELIO_NOW: "next tuesday" }),
      /HELIO_NOW must be an ISO 8601 instant, got "next tuesday"/,
    );
  });
});

void describe("helioInstalledAt", () => {
  const STORED = "2026-10-31T19:22:24.014Z";

  void it("answers the HELIO_NOW instant, whatever date the database stamped", () => {
    const read = evaluate(
      `clock.helioInstalledAt(new Date("${STORED}")).toISOString()`,
      { HELIO_NOW: INSTANT },
    );
    assert.strictEqual(read, new Date(INSTANT).toISOString());
  });

  void it("answers the stored date when HELIO_NOW is unset", () => {
    const read = evaluate(
      `clock.helioInstalledAt(new Date("${STORED}")).toISOString()`,
      {},
    );
    assert.strictEqual(read, STORED);
  });
});

void describe("helioUuid", () => {
  void it("answers the same UUID for a name on every run when HELIO_NOW fixes the instant", () => {
    const env = { HELIO_NOW: INSTANT };
    const first = evaluate('clock.helioUuid("ws-enerlux")', env);
    assert.match(first, UUID);
    assert.strictEqual(evaluate('clock.helioUuid("ws-enerlux")', env), first);
    assert.notStrictEqual(
      evaluate('clock.helioUuid("ws-wattelec")', env),
      first,
    );
    assert.notStrictEqual(
      evaluate('clock.helioUuid("ws-enerlux")', {
        HELIO_NOW: "2026-06-16T09:00:00Z",
      }),
      first,
    );
  });

  void it("answers a new UUID on every call otherwise", () => {
    const first = evaluate('clock.helioUuid("ws-enerlux")', {});
    assert.match(first, UUID);
    assert.notStrictEqual(evaluate('clock.helioUuid("ws-enerlux")', {}), first);
  });
});

void describe("helioSecret", () => {
  const HEX_48 = /^[0-9a-f]{48}$/;

  void it("answers the same secret for a name on every run when HELIO_NOW fixes the instant", () => {
    const env = { HELIO_NOW: INSTANT };
    const first = evaluate('clock.helioSecret("webhook", 24)', env);
    assert.match(first, HEX_48);
    assert.strictEqual(
      evaluate('clock.helioSecret("webhook", 24)', env),
      first,
    );
    assert.notStrictEqual(
      evaluate('clock.helioSecret("other", 24)', env),
      first,
    );
    assert.notStrictEqual(
      evaluate('clock.helioSecret("webhook", 24)', {
        HELIO_NOW: "2026-06-16T09:00:00Z",
      }),
      first,
    );
  });

  void it("answers a new secret on every call otherwise", () => {
    const first = evaluate('clock.helioSecret("webhook", 24)', {});
    assert.match(first, HEX_48);
    assert.notStrictEqual(
      evaluate('clock.helioSecret("webhook", 24)', {}),
      first,
    );
  });
});
