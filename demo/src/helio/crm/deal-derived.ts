import { GetModel } from "@antelopejs/interface-database-decorators";
import type { AfterWrite } from "@antelopejs/interface-dms/base/types/guards";
import { logActivity } from "../dashboard/log";
import { cents } from "../shared/seed";
import {
  CustomerModel,
  type Deal,
  type DealStage,
  DealModel,
} from "./database";
import type { DealRow } from "./deal-controller";
import { STAGE_PROBABILITY } from "./fixtures";
import { isKickoffNextStep } from "./kickoff-step";
import { helioNow } from "../shared/clock";

/** The probability the deal form starts from (see `deal-controller.ts`). */
const DEFAULT_PROBABILITY = STAGE_PROBABILITY.lead;

/**
 * The probability a closed deal takes, whatever it carried before: a won deal
 * is certain and a lost one gone. An open deal keeps the one its owner set.
 */
const CLOSED_PROBABILITY: Partial<Record<DealStage, number>> = {
  won: STAGE_PROBABILITY.won,
  lost: STAGE_PROBABILITY.lost,
};

/**
 * The fields of a deal that derive from others: its probability once closed,
 * its weighted amount (amount × probability), whether it is still open
 * (neither won nor lost), its customer's name (for the search), and the loss
 * reason, kept on a lost deal only (the form hides it on the other stages, and
 * a hidden field would otherwise keep the value it held).
 *
 * They are stored rather than declared `@Computed`, for two reasons seen on
 * this DMS version: the data API materializes a `@Computed` field only while a
 * list sorts or filters on it (the grid and the footer summary would show
 * nothing), and a controller with a `@Computed` field answers its `get` route
 * with every relation set to null (the kanban, which saves the row it read,
 * then fails on the mandatory customer). Every write of the pipeline table
 * brings the stored values back in step through {@link syncDerivedFields}.
 */
interface DerivedFields {
  probability: number;
  weightedAmount: number;
  isOpen: boolean;
  customerName: string;
  /** `null` clears the stored value, as a field emptied in a form does. */
  lostReason: string | null;
}

function derive(deal: Deal, customerNames: Map<string, string>): DerivedFields {
  const probability = CLOSED_PROBABILITY[deal.stage] ?? deal.probability ?? 0;
  return {
    probability,
    weightedAmount: cents((deal.amount ?? 0) * probability),
    isOpen: deal.stage !== "won" && deal.stage !== "lost",
    customerName: customerNames.get(deal.customer) ?? "",
    lostReason: deal.stage === "lost" ? (deal.lostReason ?? null) : null,
  };
}

function isStale(deal: Deal, derived: DerivedFields): boolean {
  return (
    deal.probability !== derived.probability ||
    deal.weightedAmount !== derived.weightedAmount ||
    deal.isOpen !== derived.isOpen ||
    deal.customerName !== derived.customerName ||
    (deal.lostReason ?? null) !== derived.lostReason
  );
}

/** Rewrites the derived fields of the deals where they drifted. */
export async function syncDerivedFields(): Promise<void> {
  const model = GetModel(DealModel);
  const [deals, customers] = await Promise.all([
    model.getAll(),
    GetModel(CustomerModel).getAll(),
  ]);
  const names = new Map(customers.map(({ _id, name }) => [_id, name]));
  const updates = deals
    .map((deal) => ({ deal, derived: derive(deal, names) }))
    .filter(({ deal, derived }) => isStale(deal, derived));
  await Promise.all(
    updates.map(({ deal, derived }) => model.update(deal._id, derived)),
  );
}

/**
 * The probability a deal entering `stage` takes: the stage's default, unless
 * the same write set one of its own (`sent` differs from `before`), in which
 * case it returns `undefined` and the sent value stays.
 */
const DEAL_STAGE_KEYS = new Set<string>(Object.keys(STAGE_PROBABILITY));

function isDealStage(stage: string): stage is DealStage {
  return DEAL_STAGE_KEYS.has(stage);
}

/**
 * The deal an edit guard receives: the controller's row, loaded from the
 * table, so it also carries the table's `kickoffQuote`, which the controller
 * does not declare.
 */
type LoadedDeal = Partial<DealRow> & Pick<Partial<Deal>, "kickoffQuote">;

function stageProbability(
  stage: string,
  sent: number | undefined,
  before: number | undefined,
): number | undefined {
  if (sent !== undefined && sent !== before) return undefined;
  return isDealStage(stage) ? STAGE_PROBABILITY[stage] : undefined;
}

/**
 * The pipeline table's new guard result: a deal created past the first stage
 * with the form's default probability takes its stage's, and a deal created
 * without a last activity starts with its creation (it would otherwise read
 * as stalled, an empty date being older than any). A guard does not know
 * the new row's id: the row is found by what was sent, then the derived
 * fields of every deal follow (a few hundred rows at most).
 */
export function afterDealNew(body: Partial<DealRow>): AfterWrite {
  const sent = body.probability ?? DEFAULT_PROBABILITY;
  const probability = body.stage
    ? stageProbability(body.stage, sent, DEFAULT_PROBABILITY)
    : undefined;
  const newProbability =
    probability !== undefined && probability !== sent ? probability : undefined;
  return async () => {
    if (newProbability !== undefined || !body.lastActivityAt) {
      const model = GetModel(DealModel);
      const created = (await model.getAll()).filter(
        (deal) =>
          deal.title === body.title &&
          deal.customer === body.customer &&
          deal.stage === body.stage,
      );
      const now = new Date(helioNow());
      const updates = created.map((deal) => {
        const changes: Partial<Deal> = {};
        if (newProbability !== undefined && deal.probability === sent) {
          changes.probability = newProbability;
        }
        if (!deal.lastActivityAt) changes.lastActivityAt = now;
        return { id: deal._id, changes };
      });
      await Promise.all(
        updates
          .filter(({ changes }) => Object.keys(changes).length > 0)
          .map(({ id, changes }) => model.update(id, changes)),
      );
    }
    await syncDerivedFields();
  };
}

/**
 * Logs a deal moved to "won" (across the board or from its form) to the
 * dashboard's activity feed, in its owner's name.
 */
async function logDealWon(id: string): Promise<void> {
  const deal = await GetModel(DealModel).get(id);
  if (deal?.stage !== "won") return;
  await logActivity({
    type: "deal_won",
    actor: deal.owner,
    subject: deal.title,
    record: { kind: "deal", id },
  });
}

/**
 * The pipeline table's edit guard result: a deal moved to another stage
 * (across the board or from its form) takes that stage's probability unless
 * the same edit set one, a next step typed over the kick-off a signed quote
 * planned replaces it (the kick-off sentence sent back unchanged keeps it),
 * the derived fields follow, and a deal just won is logged.
 */
export function afterDealEdit(
  id: string,
  body: Partial<DealRow>,
  current: LoadedDeal,
): AfterWrite {
  const { stage } = body;
  const moved = stage !== undefined && stage !== current.stage;
  const retyped =
    body.nextStep !== undefined &&
    !!current.kickoffQuote &&
    !isKickoffNextStep(body.nextStep, current.kickoffQuote);
  const probability = moved
    ? stageProbability(stage, body.probability, current.probability)
    : undefined;
  return async () => {
    if (probability !== undefined) {
      await GetModel(DealModel).update(id, { probability });
    }
    if (retyped) await GetModel(DealModel).update(id, { kickoffQuote: null });
    await syncDerivedFields();
    if (moved && stage === "won") await logDealWon(id);
  };
}
