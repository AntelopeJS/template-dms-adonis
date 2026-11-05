import { GetModel } from "@antelopejs/interface-database-decorators";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { TenantModel } from "@antelopejs/interface-dms/db";
import { TenantSubscriptionModel } from "@antelopejs/interface-dms-saas/db";
import { PLAN_IDS } from "./plans";
import { insertMissing } from "./rows";
import { helioUuid } from "../../shared/clock";

const PUBLISHER_NAME = "Helio SRL";

/**
 * Attaches the internal "Helio HQ" plan to the default workspace, Helio SRL's
 * own, where the owner account works. Written before the plans, so the
 * workspace holds a subscription before dms-saas could attach its default free
 * plan, which would cap the workspace's members to that plan's pages. The
 * platform owner keeps every permission either way (`*` survives the plan
 * intersection), but a colleague invited there must see the whole demo too.
 */
export async function attachHqPlan(now: Date): Promise<void> {
  await insertMissing(
    TenantSubscriptionModel,
    [
      {
        _id: DEFAULT_TENANT_ID,
        revision: helioUuid(DEFAULT_TENANT_ID),
        planId: PLAN_IDS.hq,
        status: "active",
        isComplimentary: false,
        paidUsagePeriods: [],
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeCheckoutSessionId: null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    DEFAULT_TENANT_ID,
  );
}

/** Gives the default workspace the publisher's name, the DMS naming it "Default". */
export async function nameDefaultWorkspace(): Promise<void> {
  await GetModel(TenantModel).update(DEFAULT_TENANT_ID, {
    name: PUBLISHER_NAME,
  });
}
