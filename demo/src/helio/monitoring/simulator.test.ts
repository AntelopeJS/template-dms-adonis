import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { Events, RunWithResponsibleModule } from "@antelopejs/interface-core";
import { Logging } from "@antelopejs/interface-core/logging";
import { REPORT_INTERVAL_MS } from "./solar";

const MODULE_ID = "template-dms-demo";

const simulator = RunWithResponsibleModule(
  MODULE_ID,
  () => import("./simulator"),
);

async function roundErrorsAfterOneInterval(): Promise<string[]> {
  const errors: string[] = [];
  mock.method(Logging, "Error", (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  mock.timers.tick(REPORT_INTERVAL_MS);
  await new Promise<void>((resolve) => setImmediate(resolve));
  return errors.filter((line) => line.includes("telemetry simulator"));
}

void describe("monitoring simulator", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setInterval"] });
  });

  afterEach(async () => {
    (await simulator).stopMonitoringSimulator();
    mock.timers.reset();
    mock.restoreAll();
  });

  void it("runs no round when its module starts, before the schema is bound", async () => {
    await simulator;
    Events.ModuleStarted.emit(MODULE_ID);
    assert.deepStrictEqual(await roundErrorsAfterOneInterval(), []);
  });

  void it("runs a round one interval after it is started", async () => {
    (await simulator).startMonitoringSimulator();
    const errors = await roundErrorsAfterOneInterval();
    assert.match(errors.join("\n"), /Site is not bound to a schema/);
  });
});
