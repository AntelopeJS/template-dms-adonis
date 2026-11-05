import { GetModel } from "@antelopejs/interface-database-decorators";
import {
  type Feature,
  FeatureModel,
  type Plan,
  PlanModel,
} from "@antelopejs/interface-dms-saas/db";
import { FEATURES, type LocalizedText, type SeedFeature } from "./features";
import { permissionsOf } from "./permissions";
import { PLANS, type SeedPlan } from "./plans";
import { insertMissing, type SeedRow } from "./rows";

/** Every locale of a localized field is written at once. */
const ALL_LOCALES = "*";

/**
 * What a feature without a tooltip or a unit holds: one empty text per
 * language, as the DMS form writes it, because a localized field cannot be
 * read back from a null.
 */
const NO_TEXT: LocalizedText = { en: "", fr: "" };

function toFeatureRow(feature: SeedFeature): SeedRow<Feature> {
  const { id, ...fields } = feature;
  return {
    ...fields,
    tooltip: fields.tooltip ?? NO_TEXT,
    unit: fields.unit ?? NO_TEXT,
    _id: id,
  };
}

function localizeAll<Row extends Pick<Feature | Plan, "localize">>(
  row: Row,
): Row {
  return row.localize(ALL_LOCALES);
}

/**
 * A plan has no `borderLabel` field at all when it has no badge, for the same
 * reason as `NO_TEXT`: a localized field cannot be read back from a null.
 */
function toPlanRow(
  plan: SeedPlan,
  grantable: string[],
  createdAt: Date,
): SeedRow<Plan> {
  const { id, grant, features, borderLabel, ...fields } = plan;
  const row: SeedRow<Plan> = {
    ...fields,
    _id: id,
    features: Object.entries(features).map(([featureId, value]) => ({
      featureId,
      value,
    })),
    permissions: permissionsOf(grant, grantable),
    paymentProviderRefs: {},
    borderColor: null,
    isActive: true,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  };
  if (borderLabel) row.borderLabel = borderLabel;
  return row;
}

/**
 * Writes the features and plans that are not stored yet. The payment provider
 * references stay dms-saas's to write.
 */
export async function writeCatalogue(
  grantable: string[],
  createdAt: Date,
): Promise<void> {
  await insertMissing(
    FeatureModel,
    FEATURES.map(toFeatureRow),
    undefined,
    localizeAll,
  );
  await insertMissing(
    PlanModel,
    PLANS.map((plan) => toPlanRow(plan, grantable, createdAt)),
    undefined,
    localizeAll,
  );
}

/**
 * Adds to each seeded plan the ids its grant covers and it lacks, so a page
 * registered since the plan was written is not hidden from every workspace
 * owner by a stale catalogue. Permissions are only ever added, never removed,
 * so an operator's own grants survive.
 */
export async function grantNewPermissions(grantable: string[]): Promise<void> {
  const model = GetModel(PlanModel);
  for (const seeded of PLANS) {
    const plan = await model.get(seeded.id);
    if (!plan || plan.isDeleted) continue;
    const held = new Set(plan.permissions ?? []);
    const missing = permissionsOf(seeded.grant, grantable).filter(
      (id) => !held.has(id),
    );
    if (missing.length === 0) continue;
    await model.update(plan._id, { permissions: [...held, ...missing] });
  }
}
