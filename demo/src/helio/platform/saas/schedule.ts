import { findPlan } from "./plans";
import { addDays, addMonths } from "./rows";
import type { SeedWorkspace } from "./workspaces";

const MONTHS_PER_YEAR = 12;
/** A dunning older than this would be auto-suspended soon (default 14 days). */
export const DUNNING_MAX_AGE_DAYS = 8;
const DUNNING_RESET_AGE_DAYS = 5;
/** More periods than any seeded workspace can reach, as a loop guard. */
const MAX_PERIODS = 600;

export interface BillingPeriod {
  /** 0 for the first period. */
  index: number;
  start: Date;
  end: Date;
}

function monthsPerPeriod(workspace: SeedWorkspace): number {
  return findPlan(workspace.planId).interval === "year" ? MONTHS_PER_YEAR : 1;
}

function periodAt(
  workspace: SeedWorkspace,
  anchor: Date,
  index: number,
): BillingPeriod {
  const months = monthsPerPeriod(workspace);
  return {
    index,
    start: addMonths(anchor, index * months),
    end: addMonths(anchor, (index + 1) * months),
  };
}

/** Whether the workspace is invoiced at all: paid plan, trial over. */
export function isInvoiced(workspace: SeedWorkspace): boolean {
  return (
    findPlan(workspace.planId).price > 0 && workspace.status !== "trialing"
  );
}

/**
 * The billing calendar of a workspace: a period starts on each monthly (or
 * yearly) anniversary of `anchor`, the workspace's creation date as stored on
 * its tenant row. Deriving periods from a stored date keeps invoices, numbers
 * and renewals the same on every boot, while new periods keep appearing as
 * time passes. Returns the periods begun by `now`, capped for a workspace that
 * churned.
 */
export function billingPeriods(
  workspace: SeedWorkspace,
  anchor: Date,
  now: Date,
): BillingPeriod[] {
  if (!isInvoiced(workspace)) return [];
  const limit = Math.min(workspace.billedPeriods ?? MAX_PERIODS, MAX_PERIODS);
  const periods: BillingPeriod[] = [];
  for (let index = 0; index < limit; index++) {
    const period = periodAt(workspace, anchor, index);
    if (period.start > now) break;
    periods.push(period);
  }
  return periods;
}

/** The next anniversary after `now`: when the subscription renews. */
export function nextRenewal(
  workspace: SeedWorkspace,
  anchor: Date,
  now: Date,
): Date {
  for (let index = 1; index < MAX_PERIODS; index++) {
    const { start } = periodAt(workspace, anchor, index);
    if (start > now) return start;
  }
  return addMonths(now, monthsPerPeriod(workspace));
}

/**
 * When the dunning of a past-due workspace began: the failed invoice's date
 * while it is recent, else a few days ago, so the auto-suspend cron (14 days
 * by default) never reaches the showcase's dunning workspace.
 */
export function dunningSince(
  workspace: SeedWorkspace,
  anchor: Date,
  now: Date,
): Date {
  const periods = billingPeriods(workspace, anchor, now);
  const latest = periods[periods.length - 1];
  const threshold = addDays(now, -DUNNING_MAX_AGE_DAYS);
  if (latest && latest.start > threshold) return latest.start;
  return addDays(now, -DUNNING_RESET_AGE_DAYS);
}
