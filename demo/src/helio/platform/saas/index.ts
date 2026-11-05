import { Logging } from "@antelopejs/interface-core/logging";
import { RecomputeTenantBillingState } from "@antelopejs/interface-dms-saas/billing";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { Hook, RegisterHook } from "@antelopejs/interface-dms/hooks";
import { writeDefaultBilling } from "./default-billing";
import { attachHqPlan, nameDefaultWorkspace } from "./default-workspace";
import { registerOwnerLink } from "./owner";
import { readGrantablePermissions } from "./permissions";
import { upkeepWorkspace } from "./upkeep";
import { grantNewPermissions, writeCatalogue } from "./write-catalogue";
import { writeWorkspace } from "./write-workspaces";
import { WORKSPACES } from "./workspaces";
import { helioNow } from "../../shared/clock";

const LOG_PREFIX = "[helio:saas]";
/** When the catalogue was first published, relative to the first boot. */
const CATALOGUE_AGE_DAYS = 540;
const MS_PER_DAY = 86_400_000;

/**
 * Seeds the SaaS showcase: Helio sold as a vertical ERP to solar and
 * EV-charger installers. Writes the dms-saas catalogue (features, and plans
 * gating Helio's pages), Helio SRL's own workspace with its billing history,
 * and a handful of installer workspaces with their subscriptions and invoices,
 * so Modules > SaaS reads like a live business. Run it once, when the DMS
 * provisions its default tenant.
 *
 * The installer workspaces have no owner yet: the onboarding comes after, and
 * its `MEMBER_ADDED` hands them over (owner.ts). The HQ plan is attached
 * before the catalogue's plans are written, so dms-saas never attaches its
 * default plan to the default workspace instead.
 */
export async function provisionSaasShowcase(): Promise<void> {
  const now = new Date(helioNow());
  const grantable = await readGrantablePermissions();
  await attachHqPlan(now);
  await writeCatalogue(
    grantable,
    new Date(now.getTime() - CATALOGUE_AGE_DAYS * MS_PER_DAY),
  );
  await nameDefaultWorkspace();
  for (const workspace of WORKSPACES) {
    await writeWorkspace(workspace, grantable, now);
    await upkeepWorkspace(workspace, now);
  }
  await writeDefaultBilling(now);
  await RecomputeTenantBillingState(DEFAULT_TENANT_ID);
  Logging.Info(
    `${LOG_PREFIX} ${WORKSPACES.length} installer workspace(s) seeded`,
  );
}

/**
 * The demo clock: moves the installer workspaces' dates on, and adds to the
 * plans the pages a Helio domain registered since. A failure is logged, never
 * thrown: the showcase must not keep the DMS from serving.
 */
async function upkeepShowcase(): Promise<void> {
  try {
    await grantNewPermissions(await readGrantablePermissions());
    const now = new Date(helioNow());
    for (const workspace of WORKSPACES) await upkeepWorkspace(workspace, now);
  } catch (error) {
    Logging.Error(`${LOG_PREFIX} upkeep failed`, error);
  }
}

/**
 * Hands the installer workspaces to the onboarding owner, and keeps them
 * current on every boot. `DATABASE_INITIALIZED` is a sticky hook, so the
 * upkeep also runs at once after a hot reload of this module. It is not
 * awaited: the DMS start waits for its hook handlers, and the upkeep must not
 * delay the dashboard.
 */
export function registerSaasShowcase(): void {
  registerOwnerLink();
  RegisterHook(Hook.DATABASE_INITIALIZED, () => {
    void upkeepShowcase();
    return undefined;
  });
}
