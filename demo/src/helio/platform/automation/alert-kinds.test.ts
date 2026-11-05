import assert from "node:assert";
import { describe, it } from "node:test";
import { alertKindOf, priorityOf } from "./alert-kinds";

const INHERITED_NAMES = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
];

void describe("alertKindOf", () => {
  void it("reads the kind of each known alert", () => {
    assert.strictEqual(
      alertKindOf("inverter_offline").category,
      "inverter_error",
    );
    assert.strictEqual(alertKindOf("low_production").category, "no_production");
  });

  void it("opens a generic monitoring ticket for a missing or unknown alert", () => {
    const generic = { category: "monitoring", subject: "anomalie détectée" };
    assert.deepStrictEqual(alertKindOf(undefined), generic);
    assert.deepStrictEqual(alertKindOf("unknown_alert"), generic);
  });

  void it("reads a webhook value that is not a string the way a property key reads it", () => {
    assert.strictEqual(
      alertKindOf(["inverter_offline"]).category,
      "inverter_error",
    );
    assert.strictEqual(
      alertKindOf([["low_production"]]).category,
      "no_production",
    );
    const generic = alertKindOf(undefined);
    assert.deepStrictEqual(alertKindOf(1), generic);
    assert.deepStrictEqual(alertKindOf(null), generic);
    assert.deepStrictEqual(alertKindOf({ alert: "string_fault" }), generic);
    assert.deepStrictEqual(alertKindOf(["string_fault", "x"]), generic);
  });

  void it("refuses an alert object with a toString key, as a property key lookup does", () => {
    assert.throws(() => alertKindOf({ toString: "x" }), TypeError);
    assert.throws(() => alertKindOf([{ toString: "x" }]), TypeError);
    assert.deepStrictEqual(
      alertKindOf({ valueOf: "inverter_offline" }),
      alertKindOf(undefined),
    );
  });

  void it("opens the generic ticket for an alert named like an Object member", () => {
    const generic = alertKindOf(undefined);
    for (const name of INHERITED_NAMES) {
      assert.deepStrictEqual(alertKindOf(name), generic, name);
    }
  });
});

void describe("priorityOf", () => {
  void it("maps each known severity", () => {
    assert.strictEqual(priorityOf("critical"), "urgent");
    assert.strictEqual(priorityOf("warning"), "high");
    assert.strictEqual(priorityOf("info"), "normal");
  });

  void it("answers normal for a missing or unknown severity", () => {
    assert.strictEqual(priorityOf(undefined), "normal");
    assert.strictEqual(priorityOf("severe"), "normal");
  });

  void it("reads a webhook value that is not a string the way a property key reads it", () => {
    assert.strictEqual(priorityOf(["critical"]), "urgent");
    assert.strictEqual(priorityOf(["warning"]), "high");
    assert.strictEqual(priorityOf(true), "normal");
    assert.strictEqual(priorityOf(["critical", "info"]), "normal");
  });

  void it("refuses a severity object with a toString key, as a property key lookup does", () => {
    assert.throws(() => priorityOf({ toString: "critical" }), TypeError);
    assert.throws(() => priorityOf([{ toString: "critical" }]), TypeError);
    assert.strictEqual(priorityOf({ valueOf: "critical" }), "normal");
  });

  void it("answers normal for a severity named like an Object member", () => {
    for (const name of INHERITED_NAMES) {
      assert.strictEqual(priorityOf(name), "normal", name);
    }
  });
});
