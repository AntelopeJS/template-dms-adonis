import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, it } from "node:test";
import { STEPS } from "../provisioning";
import {
  pinSettingsRow,
  pinWebhookSecret,
  requireWebhookSecretRow,
  type SettingsRowQuery,
  type StoredSettings,
} from "./webhook-secret";

/** The pin reads one settings row, so it answers in milliseconds. A step that waits on a service that never answers fails the test after this long. */
const STEP_TIMEOUT_MS = 30_000;
const INSTANT = "2026-06-15T09:00:00Z";
const WEBHOOK_SECRET = join(__dirname, "webhook-secret.js");
const CLOCK = join(__dirname, "../../shared/clock.js");

function inFreshProcess(script: string, env: Record<string, string>): string {
  const { HELIO_NOW: _unset, ...inherited } = process.env;
  return execFileSync(process.execPath, ["-e", script], {
    env: { ...inherited, ...env },
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function pinInFreshProcess(env: Record<string, string>): string {
  return inFreshProcess(
    `const { pinSettingsRow } = require(${JSON.stringify(WEBHOOK_SECRET)});
const row = {
  run: async () => ({ webhookSecret: "old" }),
  update: ({ webhookSecret }) => ({ run: async () => { console.log(webhookSecret); return 1; } }),
};
pinSettingsRow(row);`,
    env,
  );
}

interface RecordingRow {
  row: SettingsRowQuery;
  events: string[];
  written: string[];
}

function recordingRow(
  found: StoredSettings,
  updateAnswer: number = 1,
): RecordingRow {
  const events: string[] = [];
  const written: string[] = [];
  const row: SettingsRowQuery = {
    run: () => {
      events.push("read");
      return Promise.resolve(found);
    },
    update: ({ webhookSecret }) => ({
      run: () => {
        events.push("write");
        written.push(webhookSecret);
        return Promise.resolve(updateAnswer);
      },
    }),
  };
  return { row, events, written };
}

void describe("requireWebhookSecretRow", () => {
  void it("accepts a row with a string webhookSecret", () => {
    assert.doesNotThrow(() =>
      requireWebhookSecretRow({ _id: "default", webhookSecret: "abc" }),
    );
  });

  void it("names a missing row", () => {
    for (const row of [null, undefined]) {
      assert.throws(() => requireWebhookSecretRow(row), {
        name: "WebhookSecretPinError",
        message: /has no row/,
      });
    }
  });

  void it("names a row without a string webhookSecret", () => {
    for (const row of [{}, { _id: "default" }, { webhookSecret: 12 }]) {
      assert.throws(() => requireWebhookSecretRow(row), {
        name: "WebhookSecretPinError",
        message: /no string "webhookSecret"/,
      });
    }
  });
});

void describe("pinWebhookSecret", () => {
  void it("leaves the module's secret alone without HELIO_NOW", async () => {
    const { HELIO_NOW: previous } = process.env;
    delete process.env.HELIO_NOW;
    try {
      await assert.doesNotReject(pinWebhookSecret());
    } finally {
      if (previous !== undefined) process.env.HELIO_NOW = previous;
    }
  });

  void it("throws a named error under HELIO_NOW when the tenant schema is not defined", async () => {
    const { HELIO_NOW: previous } = process.env;
    process.env.HELIO_NOW = "2026-06-15T09:00:00Z";
    try {
      await assert.rejects(pinWebhookSecret(), {
        name: "WebhookSecretPinError",
        message: /is not defined/,
      });
    } finally {
      if (previous === undefined) delete process.env.HELIO_NOW;
      else process.env.HELIO_NOW = previous;
    }
  });
});

void describe("pinSettingsRow", () => {
  void it("reads the row before it writes", async () => {
    const { row, events } = recordingRow({ webhookSecret: "old" });
    await pinSettingsRow(row);
    assert.deepStrictEqual(events, ["read", "write"]);
  });

  void it("writes exactly once, a 48 character hex secret, to a valid row", async () => {
    const { row, written } = recordingRow({ webhookSecret: "old" });
    await pinSettingsRow(row);
    assert.strictEqual(written.length, 1);
    assert.match(written[0] ?? "", /^[0-9a-f]{48}$/);
  });

  void it("rejects a missing row, a row without a string field and writes nothing", async () => {
    for (const found of [undefined, null, {}, { webhookSecret: 12 }]) {
      const { row, events } = recordingRow(found);
      await assert.rejects(pinSettingsRow(row), {
        name: "WebhookSecretPinError",
      });
      assert.deepStrictEqual(events, ["read"]);
    }
  });

  void it("writes the same secret in two processes under HELIO_NOW, derived from it", () => {
    const first = pinInFreshProcess({ HELIO_NOW: INSTANT });
    const second = pinInFreshProcess({ HELIO_NOW: INSTANT });
    const derived = inFreshProcess(
      `console.log(require(${JSON.stringify(CLOCK)}).helioSecret("mailing-webhook", 24))`,
      { HELIO_NOW: INSTANT },
    );
    assert.match(first, /^[0-9a-f]{48}$/);
    assert.strictEqual(first, second);
    assert.strictEqual(first, derived);
  });

  void it("writes another secret under another HELIO_NOW", () => {
    assert.notStrictEqual(
      pinInFreshProcess({ HELIO_NOW: INSTANT }),
      pinInFreshProcess({ HELIO_NOW: "2026-06-16T09:00:00Z" }),
    );
  });

  void it("surfaces a failed write instead of ignoring it", async () => {
    const row: SettingsRowQuery = {
      run: () => Promise.resolve({ webhookSecret: "old" }),
      update: () => ({ run: () => Promise.reject(new Error("write refused")) }),
    };
    await assert.rejects(pinSettingsRow(row), { message: "write refused" });
  });

  void it("does not reject when the write reports 0 changed rows", async () => {
    const { row, written } = recordingRow({ webhookSecret: "same" }, 0);
    await assert.doesNotReject(pinSettingsRow(row));
    assert.strictEqual(written.length, 1);
  });
});

void describe("provisioning steps", () => {
  const names = STEPS.map((step) => step.name);

  void it("runs the webhook secret pin as its own step", () => {
    assert.strictEqual(
      names.filter((name) => name === "mailing webhook secret").length,
      1,
    );
  });

  void it(
    "runs the pin's behaviour in that step",
    { timeout: STEP_TIMEOUT_MS },
    async () => {
      const step = STEPS.find(
        (entry) => entry.name === "mailing webhook secret",
      );
      assert.ok(step);
      const { HELIO_NOW: previous } = process.env;
      process.env.HELIO_NOW = INSTANT;
      try {
        await assert.rejects(step.run(), {
          name: "WebhookSecretPinError",
          message: /is not defined/,
        });
      } finally {
        if (previous === undefined) delete process.env.HELIO_NOW;
        else process.env.HELIO_NOW = previous;
      }
    },
  );

  void it("runs the pin after the mailing step", () => {
    assert.ok(names.includes("mailing"));
    assert.ok(
      names.indexOf("mailing webhook secret") > names.indexOf("mailing"),
    );
  });
});
