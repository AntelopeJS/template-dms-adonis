import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { type User, UserModel } from "@antelopejs/interface-dms/auth/db";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { TenantMemberModel, TenantModel } from "@antelopejs/interface-dms/db";
import { Hook, RegisterHook } from "@antelopejs/interface-dms/hooks";
import { applyTenantOwnership } from "@antelopejs/interface-dms/tenant-ownership";
import { RecomputeTenantBillingState } from "@antelopejs/interface-dms-saas/billing";
import { TenantSubscriptionModel } from "@antelopejs/interface-dms-saas/db";
import { WORKSPACES } from "./workspaces";

const LOG_PREFIX = "[helio:saas]";

function createdTime(user: User): number {
  return new Date(user.createdAt).getTime();
}

/**
 * The account the onboarding created: the oldest platform owner, so one made
 * owner later never takes the workspaces over.
 *
 * @returns The owner, or undefined while the onboarding is not done
 */
async function findOnboardingOwner(): Promise<User | undefined> {
  const owners = await GetModel(UserModel).getOwners();
  return owners.sort((a, b) => createdTime(a) - createdTime(b))[0];
}

/** Records the owner as the subscription's creator, unless someone is. */
async function claimSubscription(
  workspaceId: string,
  ownerId: string,
): Promise<boolean> {
  const model = GetModel(TenantSubscriptionModel, workspaceId);
  const subscription = await model.get(workspaceId);
  if (!subscription) return false;
  if (subscription.createdBy) return false;
  await model.update(workspaceId, { createdBy: ownerId });
  return true;
}

/**
 * Makes `owner` the owner of one seeded workspace when it has none, so
 * ownership handed over to a colleague stays. The owner joins through
 * `applyTenantOwnership`, the DMS membership API, so the membership hooks run:
 * dms-saas checks the seat limit and refreshes the workspace directory its
 * back office reads (owner name and e-mail, members, seats).
 *
 * @returns Whether anything changed, so the caller refreshes its billing state
 */
async function linkWorkspace(
  workspaceId: string,
  owner: User,
): Promise<boolean> {
  if (!(await GetModel(TenantModel).get(workspaceId))) return false;
  let changed = false;
  const owners = await GetModel(TenantMemberModel, workspaceId).listOwners();
  if (owners.length === 0) {
    await applyTenantOwnership(GetModel(UserModel), owner._id, workspaceId, {
      roleIds: [],
      isTenantOwner: true,
    });
    changed = true;
  }
  if (await claimSubscription(workspaceId, owner._id)) changed = true;
  return changed;
}

/**
 * Links every seeded workspace to the onboarding owner, if there is one. It
 * runs off the onboarding request and logs a failure instead of throwing: it
 * must never fail that request.
 */
async function linkAllWorkspaces(): Promise<void> {
  try {
    const owner = await findOnboardingOwner();
    if (!owner) return;
    let linked = 0;
    for (const workspace of WORKSPACES) {
      if (!(await linkWorkspace(workspace.id, owner))) continue;
      await RecomputeTenantBillingState(workspace.id);
      linked++;
    }
    if (linked > 0)
      Logging.Info(`${LOG_PREFIX} ${linked} workspace(s) given to the owner`);
  } catch (error) {
    Logging.Error(`${LOG_PREFIX} linking the workspaces failed`, error);
  }
}

/**
 * Gives the installer workspaces to the platform owner, the person who
 * completed the onboarding. That account does not exist when the DMS
 * provisions the default tenant, so the workspaces are written without anybody
 * and linked right after the onboarding, which adds its new account as owner
 * of the default workspace: `Hook.MEMBER_ADDED` fires for the default tenant
 * with `isTenantOwner`. Members joining the installer workspaces (this linking
 * included) and later colleagues are ignored. The linking is not awaited: the
 * onboarding request waits for its hook handlers.
 */
export function registerOwnerLink(): void {
  RegisterHook(Hook.MEMBER_ADDED, ({ tenantId, isTenantOwner }) => {
    if (tenantId !== DEFAULT_TENANT_ID || !isTenantOwner) return undefined;
    void linkAllWorkspaces();
    return undefined;
  });
}
