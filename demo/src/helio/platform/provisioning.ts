import { Logging } from "@antelopejs/interface-core/logging";
import { Events } from "@antelopejs/interface-core/modules";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { Hook, RegisterHook } from "@antelopejs/interface-dms/hooks";
import { runHelioFirstRuns } from "./automation";
import { provisionHelioMailing } from "./mailing";
import { pinWebhookSecret } from "./mailing/webhook-secret";
import { provisionHelioMarketing } from "./marketing";
import { provisionHelioMedia } from "./media";
import {
  PROVISIONING_DONE,
  PROVISIONING_INCOMPLETE,
} from "./provisioning-report";
import { provisionSaasShowcase } from "./saas";

/**
 * One unit of Helio's default-tenant provisioning. `signal` aborts once the
 * modules start stopping: a long step checks it between its own writes.
 */
export interface ProvisioningStep {
  name: string;
  run: (signal: AbortSignal) => Promise<void>;
}

/** The provisioning steps, in the order they run. */
export const STEPS: ProvisioningStep[] = [
  { name: "saas showcase", run: provisionSaasShowcase },
  { name: "mailing", run: provisionHelioMailing },
  { name: "mailing webhook secret", run: pinWebhookSecret },
  { name: "media", run: provisionHelioMedia },
  { name: "marketing", run: provisionHelioMarketing },
  { name: "automation first runs", run: runHelioFirstRuns },
];

function stoppedAt(step: ProvisioningStep): Error {
  return new Error(
    `Helio provisioning stopped at ${step.name}: the modules are stopping`,
  );
}

/**
 * Runs `steps` in order. A step that fails is logged and the next one still
 * runs, then the run logs and rejects naming every failed step; a run where
 * every step ran logs that it is done. Once the modules start
 * stopping (`Events.ModulesStopping`), the run aborts the signal it passes to
 * each step, starts no further step and rejects, so a stop waits at most for
 * the write the running step had already started.
 */
export async function runProvisioningSteps(
  steps: readonly ProvisioningStep[],
): Promise<void> {
  const stopping = new AbortController();
  const onStopping = (): void => {
    stopping.abort();
  };
  Events.ModulesStopping.register(onStopping);
  const failed: string[] = [];
  try {
    for (const step of steps) {
      if (stopping.signal.aborted) throw stoppedAt(step);
      try {
        await step.run(stopping.signal);
      } catch (error) {
        if (stopping.signal.aborted) throw stoppedAt(step);
        Logging.Error(`[helio] ${step.name} provisioning failed`, error);
        failed.push(step.name);
      }
    }
  } finally {
    Events.ModulesStopping.unregister(onStopping);
  }
  if (failed.length > 0) {
    const incomplete = `${PROVISIONING_INCOMPLETE}: ${failed.join(", ")}`;
    Logging.Error(`[helio] ${incomplete}`);
    throw new Error(incomplete);
  }
  Logging.Info(`[helio] ${PROVISIONING_DONE}`);
}

/**
 * Writes Helio's data in the default tenant (the SaaS showcase, the e-mails,
 * the media library and the public website), then runs the new procedures'
 * first runs, when the DMS provisions that tenant. From then on the data belongs to the tenant: a later start does not
 * write it again. When a step fails, or the modules stop before the last step
 * ran, the hook rejects so the DMS keeps provisioning pending and runs every
 * step again on its next attempt, each one skipping what it already wrote.
 */
export function registerHelioProvisioning(): void {
  RegisterHook(Hook.TENANT_BEING_PROVISIONED, async ({ tenantId }) => {
    if (tenantId !== DEFAULT_TENANT_ID) return undefined;
    await runProvisioningSteps(STEPS);
    return undefined;
  });
}
