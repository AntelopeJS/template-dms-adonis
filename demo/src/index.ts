import { RegisterSchema } from "@antelopejs/interface-database-decorators";
import { Hook, RegisterHook } from "@antelopejs/interface-dms/hooks";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { frontendModule } from "./frontend-module";
import {
  registerHelioAutomationNodes,
  startHelioAutomation,
} from "./helio/platform/automation";
import { registerHelioProvisioning } from "./helio/platform/provisioning";
import { registerSaasShowcase } from "./helio/platform/saas";
import { startServiceSimulator, stopServiceSimulator } from "./helio/service";
import { DEMO_SCHEMA_NAME } from "./schema";
import "./home";
import "./helio";

/**
 * Registers the frontend module, the template's schema and Helio's extensions.
 *
 * The frontend module is added here, not in `start()`, so dms-lang, which lists
 * the frontend modules once in its own `start()`, finds it. The schema is
 * provisioned and its fixtures run in a `DATABASE_INITIALIZED` hook, once the DMS
 * has registered its own and before it provisions its default tenant, whose Helio
 * data reads these tables. The service desk simulator writes tickets, so it
 * starts in that hook, only once the schema exists. Helio's triggers and actions
 * are registered with the automation builder.
 */
export async function construct(): Promise<void> {
  await AddFrontendModule(frontendModule());

  RegisterHook(Hook.DATABASE_INITIALIZED, async () => {
    await RegisterSchema(DEMO_SCHEMA_NAME);
    startServiceSimulator();
    return undefined;
  });
  registerSaasShowcase();
  registerHelioProvisioning();
  registerHelioAutomationNodes();
}

/** Declares Helio's automation procedures in the background; this never fails startup. */
export async function start(): Promise<void> {
  startHelioAutomation();
}

/**
 * Stops the service desk simulator, which runs on a timer started in the
 * `DATABASE_INITIALIZED` hook, so no ticket is created after the module is gone.
 */
export function destroy(): void {
  stopServiceSimulator();
}

/** Stops the service desk simulator, like `destroy()`. */
export function stop(): void {
  stopServiceSimulator();
}
