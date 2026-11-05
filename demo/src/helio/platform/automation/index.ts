import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { UserModel } from "@antelopejs/interface-dms/auth/db";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { Hook, RegisterHook } from "@antelopejs/interface-dms/hooks";
import {
  DeclareProcedure,
  InvokeProcedure,
  ListActionTypes,
  RegisterActionType,
  RegisterTriggerType,
} from "@antelopejs/interface-dms-automation";
import { businessActionTypes } from "./actions-business";
import { serviceActionTypes } from "./actions-service";
import {
  FIRST_RUN_PROCEDURES,
  HELIO_PROCEDURES,
  OWNER_NOTIFYING_PROCEDURES,
} from "./procedures";
import { helioTriggerTypes } from "./triggers";

export { fireQuoteAccepted, fireTicketOpened } from "./events";

/**
 * Adds the Helio triggers and actions to the procedure builder. Call it from
 * construct(): the registrations are queued until the automation module
 * attaches and removed with this module on unload.
 */
export function registerHelioAutomationNodes(): void {
  for (const trigger of helioTriggerTypes) RegisterTriggerType(trigger);
  for (const action of [...serviceActionTypes, ...businessActionTypes]) {
    RegisterActionType(action);
  }
}

/**
 * Runs a procedure created just now once, so its run history is not empty and
 * the reminders and confirmations due today go out.
 */
async function firstRun(id: string): Promise<void> {
  try {
    const runId = await InvokeProcedure(id, {});
    Logging.Info(`[helio] first run of ${id}: ${runId}`);
  } catch (error) {
    Logging.Warn(`[helio] first run of ${id} failed: ${String(error)}`);
  }
}

/** Ids of the procedures whose first run is held back until the platform has an owner to notify. */
const awaitingOwner = new Set<string>();
let ownerHookRegistered = false;

async function hasOwner(): Promise<boolean> {
  return (await GetModel(UserModel).getOwners()).length > 0;
}

/**
 * Runs a procedure that notifies the owners once there is one. On a fresh
 * install the procedures are created at the first start, before the
 * onboarding: run then, "Find the managers" would answer nobody and the
 * notification fail. The onboarding adds the account it creates as owner of
 * the default workspace, which fires `Hook.MEMBER_ADDED`: the held-back runs
 * go then, not awaited because the onboarding request waits for its hook
 * handlers.
 */
async function firstRunWithOwner(id: string): Promise<void> {
  if (await hasOwner()) {
    await firstRun(id);
    return;
  }
  awaitingOwner.add(id);
  Logging.Info(`[helio] first run of ${id} waits for the onboarding`);
  if (ownerHookRegistered) return;
  ownerHookRegistered = true;
  RegisterHook(Hook.MEMBER_ADDED, ({ tenantId, isTenantOwner }) => {
    if (tenantId !== DEFAULT_TENANT_ID || !isTenantOwner) return undefined;
    const ids = [...awaitingOwner];
    awaitingOwner.clear();
    void (async () => {
      for (const pending of ids) await firstRun(pending);
    })();
    return undefined;
  });
}

/** How long to wait for the action types the procedures use before declaring anyway. */
const TYPE_WAIT_MS = 30_000;
/** How often the registered action types are checked while waiting. */
const TYPE_POLL_MS = 500;

/** The action types the shipped procedures use: Helio's own, and those other modules register (the DMS's "dms.send-notification"). */
function actionTypesUsed(): Set<string> {
  const ids = new Set<string>();
  for (const declaration of HELIO_PROCEDURES) {
    for (const node of declaration.graph.nodes) {
      if (node.kind === "action" && node.typeId) ids.add(node.typeId);
    }
  }
  return ids;
}

/**
 * Waits until every action type the procedures use is registered. Modules
 * register their node types as they start, in no set order: declared before
 * the DMS added "dms.send-notification", a procedure is stored with an
 * "unknown type" warning. Gives up after a while and declares anyway (the
 * automation module tolerates a type that comes late).
 *
 * The DMS adds its types once it has provisioned its default tenant, so on a
 * fresh install the Helio e-mail templates the first runs send exist by then.
 */
async function waitForActionTypes(): Promise<void> {
  const wanted = actionTypesUsed();
  const deadline = Date.now() + TYPE_WAIT_MS;
  let missing: string[] = [...wanted];
  while (Date.now() < deadline) {
    const known = new Set((await ListActionTypes()).map((type) => type.id));
    missing = [...wanted].filter((id) => !known.has(id));
    if (missing.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, TYPE_POLL_MS));
  }
  Logging.Warn(
    `[helio] declaring procedures without action types: ${missing.join(", ")}`,
  );
}

/** Declares the shipped procedures once their action types are known, and runs the first-run ones that were just created. */
async function declareProcedures(): Promise<void> {
  await waitForActionTypes();
  const outcomes: string[] = [];
  for (const declaration of HELIO_PROCEDURES) {
    const declared = await DeclareProcedure(declaration);
    outcomes.push(`${declared.id}=${declared.status}`);
    for (const issue of declared.issues) {
      Logging.Warn(
        `[helio] ${declared.id}: ${issue.severity} ${issue.message}`,
      );
    }
    if (
      declared.status === "created" &&
      FIRST_RUN_PROCEDURES.has(declared.id)
    ) {
      await (OWNER_NOTIFYING_PROCEDURES.has(declared.id)
        ? firstRunWithOwner(declared.id)
        : firstRun(declared.id));
    }
  }
  Logging.Info(`[helio] procedures: ${outcomes.join(", ")}`);
}

/**
 * Declares the five procedures shipped as code, in the background; call it
 * from start(). Never throws: Helio works without the automation module. The
 * procedures are the platform's, not a tenant's, so they are not written at
 * provisioning.
 */
export function startHelioAutomation(): void {
  declareProcedures().catch((error: unknown) => {
    Logging.Warn(`[helio] automation setup failed: ${String(error)}`);
  });
}
