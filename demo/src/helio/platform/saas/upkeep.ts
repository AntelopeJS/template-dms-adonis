import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { TenantModel } from "@antelopejs/interface-dms/db";
import { RecomputeTenantBillingState } from "@antelopejs/interface-dms-saas/billing";
import {
  type TenantSubscription,
  TenantSubscriptionModel,
} from "@antelopejs/interface-dms-saas/db";
import { addDays } from "./rows";
import { DUNNING_MAX_AGE_DAYS, dunningSince, nextRenewal } from "./schedule";
import { writeInvoices } from "./write-invoices";
import type { SeedWorkspace } from "./workspaces";
import { helioInstalledAt } from "../../shared/clock";

const LOG_PREFIX = "[helio:saas]";
/** A trial closer to its end than this is given its remaining days back. */
const TRIAL_MIN_DAYS_LEFT = 2;
/** Cancelled data is deleted 30 days after the last write (the default). */
const CANCELLED_MAX_AGE_DAYS = 14;

type SubscriptionPatch = Partial<
  Pick<TenantSubscription, "currentPeriodEnd" | "pastDueSince" | "status">
>;

function olderThan(date: Date | null, days: number, now: Date): boolean {
  return !date || new Date(date) < addDays(now, -days);
}

/**
 * What the subscription needs to read as current again, if anything. Nothing
 * is patched once the subscription no longer holds the status the seed gave
 * it, so a change an operator made is never undone. A cancelled workspace is
 * rewritten with its own status because any write moves `updatedAt`, which
 * dates the data deletion.
 */
export function freshnessPatch(
  workspace: SeedWorkspace,
  subscription: TenantSubscription,
  anchor: Date,
  now: Date,
): SubscriptionPatch | null {
  if (subscription.status !== workspace.status) return null;
  const periodEnd = subscription.currentPeriodEnd;
  switch (subscription.status) {
    case "active":
      if (!subscription.stripeSubscriptionId) return null;
      if (periodEnd && new Date(periodEnd) > now) return null;
      return { currentPeriodEnd: nextRenewal(workspace, anchor, now) };
    case "trialing":
      if (periodEnd && new Date(periodEnd) > addDays(now, TRIAL_MIN_DAYS_LEFT))
        return null;
      return { currentPeriodEnd: addDays(now, workspace.trialDaysLeft ?? 7) };
    case "past_due":
      if (!olderThan(subscription.pastDueSince, DUNNING_MAX_AGE_DAYS, now))
        return null;
      return {
        status: "past_due",
        pastDueSince: dunningSince(workspace, anchor, now),
      };
    case "cancelled":
      return olderThan(subscription.updatedAt, CANCELLED_MAX_AGE_DAYS, now)
        ? { status: "cancelled" }
        : null;
    default:
      return null;
  }
}

async function refreshSubscription(
  workspace: SeedWorkspace,
  anchor: Date,
  now: Date,
): Promise<void> {
  const model = GetModel(TenantSubscriptionModel, workspace.id);
  const subscription = await model.get(workspace.id);
  if (!subscription || subscription.domainTransition) return;
  const patch = freshnessPatch(workspace, subscription, anchor, now);
  if (patch) await model.update(workspace.id, patch);
}

/**
 * Keeps a seeded workspace believable however long the demo database lives.
 * dms-saas moves billing states on with Stripe webhooks and nightly crons;
 * without Stripe, dates would only drift into the past: renewals behind today,
 * trials ended for weeks, a dunning that a cron turns into a suspension, a
 * churned workspace hard-deleted by a cron after its retention period. Each
 * boot moves those dates forward and publishes the billing state; logs instead
 * of failing the boot. A workspace not written yet is skipped.
 */
export async function upkeepWorkspace(
  workspace: SeedWorkspace,
  now: Date,
): Promise<void> {
  try {
    const tenant = await GetModel(TenantModel).get(workspace.id);
    if (!tenant) return;
    const anchor = helioInstalledAt(tenant.createdAt);
    await writeInvoices(workspace, anchor, now);
    await refreshSubscription(workspace, anchor, now);
    await RecomputeTenantBillingState(workspace.id);
  } catch (error) {
    Logging.Warn(`${LOG_PREFIX} upkeep of ${workspace.id} failed`, error);
  }
}
