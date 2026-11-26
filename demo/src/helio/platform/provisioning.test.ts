import assert from "node:assert";
import { describe, it } from "node:test";
import { Events } from "@antelopejs/interface-core/modules";
import logs, { type Log } from "@antelopejs/interface-core/logging/listener";
import { type ProvisioningStep, runProvisioningSteps } from "./provisioning";
import { provisioningOutcome } from "./provisioning-report";

function recordingStep(
  name: string,
  ran: string[],
  during: () => void = () => undefined,
): ProvisioningStep {
  return {
    name,
    run: async () => {
      ran.push(name);
      during();
    },
  };
}

async function reportedOutcomes(
  steps: readonly ProvisioningStep[],
): Promise<(string | undefined)[]> {
  const lines: string[] = [];
  const record = (log: Log): void => {
    lines.push(log.args.map(String).join(" "));
  };
  logs.register(record);
  try {
    await runProvisioningSteps(steps).catch(() => undefined);
  } finally {
    logs.unregister(record);
  }
  return lines.map(provisioningOutcome).filter(Boolean);
}

void describe("runProvisioningSteps", () => {
  void it("logs the outcome capture:start waits for", async () => {
    const ran: string[] = [];
    assert.deepStrictEqual(
      await reportedOutcomes([recordingStep("saas", ran)]),
      ["done"],
    );
    assert.deepStrictEqual(
      await reportedOutcomes([
        recordingStep("saas", ran, () => {
          throw new Error("saas is down");
        }),
      ]),
      ["incomplete"],
    );
  });

  void it("starts no further step once the modules are stopping, and rejects", async () => {
    const ran: string[] = [];
    const steps = [
      recordingStep("saas", ran, () => Events.ModulesStopping.emit()),
      recordingStep("media", ran),
      recordingStep("marketing", ran),
    ];
    await assert.rejects(runProvisioningSteps(steps), {
      message: /stopped at media: the modules are stopping/,
    });
    assert.deepStrictEqual(ran, ["saas"]);
  });

  void it("resolves when the modules stop after the last step", async () => {
    const ran: string[] = [];
    const steps = [
      recordingStep("saas", ran),
      recordingStep("media", ran, () => Events.ModulesStopping.emit()),
    ];
    await assert.doesNotReject(runProvisioningSteps(steps));
    assert.deepStrictEqual(ran, ["saas", "media"]);
  });

  void it("runs every step when a stop happened before the run started", async () => {
    Events.ModulesStopping.emit();
    const ran: string[] = [];
    await runProvisioningSteps([
      recordingStep("saas", ran),
      recordingStep("media", ran),
    ]);
    assert.deepStrictEqual(ran, ["saas", "media"]);
  });

  void it("rejects without starting a further step when the running step stops on the signal", async () => {
    const ran: string[] = [];
    const steps: ProvisioningStep[] = [
      {
        name: "marketing",
        run: async (signal) => {
          ran.push("marketing");
          Events.ModulesStopping.emit();
          signal.throwIfAborted();
          ran.push("marketing import");
        },
      },
      recordingStep("after", ran),
    ];
    await assert.rejects(runProvisioningSteps(steps), {
      message: /stopped at marketing: the modules are stopping/,
    });
    assert.deepStrictEqual(ran, ["marketing"]);
  });

  void it("runs the next step after a failed one, then rejects naming it", async () => {
    const ran: string[] = [];
    const steps = [
      recordingStep("saas", ran, () => {
        throw new Error("saas is down");
      }),
      recordingStep("media", ran),
    ];
    await assert.rejects(runProvisioningSteps(steps), {
      message: "Helio provisioning is incomplete: saas",
    });
    assert.deepStrictEqual(ran, ["saas", "media"]);
  });
});
