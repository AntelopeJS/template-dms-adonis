import type { RequestContext } from "@antelopejs/interface-api";
import { HTTPResult } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import type { User } from "@antelopejs/interface-dms/auth/db";
import type { Action } from "@antelopejs/interface-dms/component";
import { RoleModel, TenantMemberModel } from "@antelopejs/interface-dms/db";
import {
  GetEffectiveUserPermissions,
  HasPermission,
} from "@antelopejs/interface-dms/permissions";
import { getRequestTenantId } from "@antelopejs/interface-dms/request-tenant";

/**
 * The desk table's `edit` action, which the bulk ticket routes require. It only
 * exists once the page has registered its table, and the page imports the
 * controller, so the page hands it over through `setTicketWriteAction` instead
 * of the controller importing it.
 */
let writeAction: Action | undefined;

/** Called by the page once its table registered its actions. */
export function setTicketWriteAction(action: Action | undefined): void {
  writeAction = action;
}

/**
 * Refuses (403) a caller who may not edit tickets on the desk. The ticket
 * routes call it on every request, in the place of `@AuthUserWithPermission`,
 * because the permission is not known when the controller is declared.
 */
export async function assertCanWriteTickets(
  ctx: RequestContext,
  user: User,
): Promise<void> {
  await assertCanRun(writeAction, ctx, user);
}

/** Refuses (403) a caller who lacks the permission of `action`. */
export async function assertCanRun(
  action: Action | undefined,
  ctx: RequestContext,
  user: User,
): Promise<void> {
  const permissionId = action?.permissionId;
  if (!permissionId) throw new HTTPResult(503, "Service desk not ready");
  const tenantId = getRequestTenantId(ctx);
  const member = await GetModel(TenantMemberModel, tenantId).getByUser(
    user._id,
  );
  const permissions = await GetEffectiveUserPermissions(
    user,
    tenantId,
    member?.roleIds ?? [],
    GetModel(RoleModel, tenantId),
  );
  if (!(await HasPermission(permissions, permissionId))) {
    throw new HTTPResult(403, `Forbidden: missing permission ${permissionId}`);
  }
}
