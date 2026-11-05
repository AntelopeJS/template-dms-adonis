import { Schema } from "@antelopejs/interface-database";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { TENANT_SCHEMA_NAME } from "@antelopejs/interface-dms/constants";
import {
  type Role,
  RoleModel,
  type Tenant,
  TenantModel,
} from "@antelopejs/interface-dms/db";
import {
  type PaidUsagePeriod,
  TenantBillingInfoModel,
  TenantSubscriptionModel,
} from "@antelopejs/interface-dms-saas/db";
import { RecomputeTenantBillingState } from "@antelopejs/interface-dms-saas/billing";
import {
  addDays,
  addMonths,
  insertMissing,
  type RowOf,
  type SeedRow,
} from "./rows";
import { findPlan } from "./plans";
import { dunningSince, nextRenewal } from "./schedule";
import { type SeedWorkspace, stripeSubscriptionIdOf } from "./workspaces";
import { helioUuid } from "../../shared/clock";

const MEMBER_ROLE_SUFFIX = "member";
const VAT_VERIFIED = "verified";
/** Billing states Stripe would hold a subscription for. */
const BILLED_STATUSES = new Set([
  "active",
  "past_due",
  "trialing",
  "cancelled",
]);

/** When the workspace was created, relative to now. */
export function workspaceCreatedAt(workspace: SeedWorkspace, now: Date): Date {
  return addDays(addMonths(now, -workspace.ageMonths), -workspace.ageDays);
}

function memberRoleId(tenantId: string): string {
  return `${tenantId}:${MEMBER_ROLE_SUFFIX}`;
}

/**
 * The role a colleague the owner invites gets. It holds every grantable id:
 * the plan caps what the member really gets.
 */
function memberRole(
  tenantId: string,
  permissions: string[],
  at: Date,
): SeedRow<Role> {
  return {
    _id: memberRoleId(tenantId),
    name: "Member",
    description: "Everything the workspace plan includes",
    permissions,
    createdAt: at,
    updatedAt: at,
  };
}

function paidUsagePeriods(
  workspace: SeedWorkspace,
  start: Date,
): PaidUsagePeriod[] {
  if (workspace.status === "trialing") return [];
  return [
    {
      stripeSubscriptionId: stripeSubscriptionIdOf(workspace),
      start,
      end: null,
    },
  ];
}

/**
 * A churned workspace is written active first and cancelled right after, so
 * dms-saas records the revenue it took away (the churn figures read it).
 */
function initialStatus(workspace: SeedWorkspace): SeedWorkspace["status"] {
  return workspace.status === "cancelled" ? "active" : workspace.status;
}

function currentPeriodEnd(
  workspace: SeedWorkspace,
  createdAt: Date,
  now: Date,
): Date | null {
  if (workspace.trialDaysLeft !== undefined)
    return addDays(now, workspace.trialDaysLeft);
  return nextRenewal(workspace, createdAt, now);
}

/**
 * The subscription row of a workspace. A free plan never reaches Stripe, so
 * its workspace has no subscription id there. `revision` is set because every
 * compare-and-set write of dms-saas expects one. `createdBy` stays null: it is
 * set to the platform owner once linked (owner.ts), as nobody exists yet.
 */
function toSubscriptionRow(
  workspace: SeedWorkspace,
  createdAt: Date,
  now: Date,
): SeedRow<RowOf<typeof TenantSubscriptionModel>> {
  const isBilled =
    BILLED_STATUSES.has(workspace.status) &&
    findPlan(workspace.planId).price > 0;
  const isPaid = isBilled && workspace.status !== "trialing";
  return {
    _id: workspace.id,
    revision: helioUuid(workspace.id),
    planId: workspace.planId,
    status: initialStatus(workspace),
    stripeCustomerId: null,
    stripeSubscriptionId: isBilled ? stripeSubscriptionIdOf(workspace) : null,
    stripeCheckoutSessionId: null,
    completedCheckoutSessionId: null,
    cardFingerprint: null,
    currentPeriodEnd: isBilled
      ? currentPeriodEnd(workspace, createdAt, now)
      : null,
    pendingPlanId: null,
    pendingPlanChangeAt: null,
    domainTransition: null,
    deletionStartedAt: null,
    cronNotification: null,
    refundRequestedAt: null,
    deletionRequestedAt: null,
    deletionRequestedBy: null,
    pastDueSince:
      workspace.status === "past_due"
        ? dunningSince(workspace, createdAt, now)
        : null,
    freeUntil: null,
    isComplimentary: false,
    paidUsageStartedAt: isPaid ? createdAt : null,
    paidUsagePeriods: isPaid ? paidUsagePeriods(workspace, createdAt) : [],
    createdBy: null,
    createdAt,
    updatedAt: now,
  };
}

function toBillingInfoRow(
  workspace: SeedWorkspace,
): SeedRow<RowOf<typeof TenantBillingInfoModel>> {
  return {
    ...workspace.billing,
    _id: workspace.id,
    vatVerificationStatus: workspace.billing.vatNumber ? VAT_VERIFIED : null,
  };
}

async function cancelAfterPublishing(workspace: SeedWorkspace): Promise<void> {
  await RecomputeTenantBillingState(workspace.id);
  await GetModel(TenantSubscriptionModel, workspace.id).update(workspace.id, {
    status: "cancelled",
  });
}

/**
 * Creates an installer workspace once: its tenant instance, member role,
 * billing identity and subscription. Rows go straight to the tables, as the
 * dms-saas playground does, because dms-saas has no API to create a workspace
 * without Stripe. A workspace already seeded (its subscription exists) is left
 * to dms-saas and to the upkeep.
 *
 * No account and no membership is written here: the workspace is owned by the
 * platform owner, linked through the DMS membership API once the onboarding
 * created that account (owner.ts). The tenant row is written last, so dms-saas
 * never sees a workspace without its subscription when it attaches its default
 * plan to plan-less workspaces.
 *
 * @returns Whether the workspace was created by this call
 */
export async function writeWorkspace(
  workspace: SeedWorkspace,
  permissions: string[],
  now: Date,
): Promise<boolean> {
  const { id } = workspace;
  if (await GetModel(TenantSubscriptionModel, id).table.get(id)) return false;
  const createdAt = workspaceCreatedAt(workspace, now);
  await Schema.get(TENANT_SCHEMA_NAME)?.createInstance(id);
  await insertMissing<Role>(
    RoleModel,
    [memberRole(id, permissions, createdAt)],
    id,
  );
  await insertMissing(
    TenantBillingInfoModel,
    [toBillingInfoRow(workspace)],
    id,
  );
  await insertMissing(
    TenantSubscriptionModel,
    [toSubscriptionRow(workspace, createdAt, now)],
    id,
  );
  await insertMissing<Tenant>(TenantModel, [
    { _id: id, name: workspace.name, createdAt, updatedAt: createdAt },
  ]);
  if (workspace.status === "cancelled") await cancelAfterPublishing(workspace);
  return true;
}
