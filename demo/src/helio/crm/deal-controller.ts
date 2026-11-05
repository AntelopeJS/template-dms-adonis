import { Controller, type ControllerClass } from "@antelopejs/interface-api";
import {
  DataController,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  Listable,
  Mandatory,
  ModelReference,
  Optional,
  Sortable,
} from "@antelopejs/interface-data-api/metadata";
import { Model } from "@antelopejs/interface-database-decorators";
import { IfAuthUser } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";
import {
  type CellSubline,
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { customerController, LEAD_SOURCES } from "./customer-controller";
import { Deal, type DealStage, DealModel } from "./database";
import { isKickoffNextStep, kickoffNextStep } from "./kickoff-step";
import { salesRepController } from "./sales-rep-controller";
import { helioNow } from "../shared/clock";

/** The pipeline stages, in order: the kanban columns, tabs and views read them. */
export const DEAL_STAGES = [
  {
    value: "lead",
    label: "$helio.crm.stages.lead",
    icon: "i-ph-sparkle",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "qualified",
    label: "$helio.crm.stages.qualified",
    icon: "i-ph-check-square",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "site_visit",
    label: "$helio.crm.stages.siteVisit",
    icon: "i-ph-house-line",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "proposal",
    label: "$helio.crm.stages.proposal",
    icon: "i-ph-file-text",
    iconColor: "primary",
    textColor: "primary",
  },
  {
    value: "negotiation",
    label: "$helio.crm.stages.negotiation",
    icon: "i-ph-chats-circle",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "won",
    label: "$helio.crm.stages.won",
    icon: "i-ph-trophy",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "lost",
    label: "$helio.crm.stages.lost",
    icon: "i-ph-x-circle",
    iconColor: "error",
    textColor: "error",
  },
] as const;

/** The stages still in play (neither won nor lost). */
export const OPEN_DEAL_STAGES: readonly DealStage[] = [
  "lead",
  "qualified",
  "site_visit",
  "proposal",
  "negotiation",
];

export { STAGE_PROBABILITY } from "./fixtures";

/** The reasons a lost deal can give, as the lost-reason select offers them. */
export const LOST_REASONS = [
  {
    value: "price",
    label: "$helio.crm.lostReasons.price",
    icon: "i-ph-currency-eur",
  },
  {
    value: "competitor",
    label: "$helio.crm.lostReasons.competitor",
    icon: "i-ph-sword",
  },
  {
    value: "timing",
    label: "$helio.crm.lostReasons.timing",
    icon: "i-ph-hourglass",
  },
  {
    value: "financing",
    label: "$helio.crm.lostReasons.financing",
    icon: "i-ph-bank",
  },
  {
    value: "roof",
    label: "$helio.crm.lostReasons.roof",
    icon: "i-ph-house-simple",
  },
  {
    value: "no_response",
    label: "$helio.crm.lostReasons.noResponse",
    icon: "i-ph-phone-slash",
  },
] as const;

const LOST_REASON_LABELS: ReadonlyMap<string, string> = new Map(
  LOST_REASONS.map(({ value, label }) => [value, label]),
);

/** Days without activity after which an open deal reads as stalled. */
const STALLED_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The pipeline table's data controller, served under `/api/helio/deals`.
 *
 * Not exported on purpose: emitting a `.d.ts` for this class would require
 * naming types from the nested `@antelopejs/interface-core` copies (TS2742).
 * Other domains use {@link dealController} instead.
 */
@RegisterDataController()
class dealDataAPI extends DataController(
  Deal,
  TableViewRoutes.All,
  Controller("/api/helio/deals"),
) {
  @ModelReference()
  @Model(DealModel)
  declare model: DealModel;

  /** The signed-in reader, whose profile language words the kick-off next step. */
  @IfAuthUser()
  declare reader?: User;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  /**
   * The deal's title. The deal drawer's header names the deal, so its
   * read-only view (read through `get`) leaves the title out; the forms keep it.
   */
  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.title",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.crm.deals.placeholders.title",
      maxLength: 120,
    }),
    filterable: true,
    size: 280,
    display: new DefaultDisplays.TwoLineDisplay({
      subField: "nextStepLine",
    }),
    readonlyBehavior: { view: ReadonlyBehaviorType.hidden },
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite, { get: AccessMode.ReadOnly })
  declare title: string;

  @Select()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.crm.deals.placeholders.customer",
      addForm: {
        displayName: "$helio.crm.deals.addCustomer.title",
        description: "$helio.crm.deals.addCustomer.description",
      },
    }),
    filterable: true,
    size: 220,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  /**
   * The customer's name, stored with the deal (`deal-derived.ts` keeps it in
   * step) so the search box finds a deal by its customer: a search reads the
   * stored fields, not the joined customer.
   */
  @Searchable()
  @Column({
    name: "$helio.crm.deals.columns.customerName",
    type: new DefaultDataTypes.StringType(),
    validate: false,
    isVisible: false,
    readonlyBehavior: ReadonlyBehaviorType.hidden,
  })
  @Access(AccessMode.ReadOnly)
  declare customerName: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.stage",
    type: new DefaultDataTypes.SelectType({ items: [...DEAL_STAGES] }),
    filterable: true,
    defaultValue: "lead",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        lead: "neutral",
        qualified: "info",
        site_visit: "info",
        proposal: "primary",
        negotiation: "warning",
        won: "success",
        lost: "error",
      },
      subField: "stageDetail",
      subTone: "muted",
    }),
    size: 170,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare stage: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.amount",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 130,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare amount: number;

  /**
   * The chance the deal closes. A won or lost deal's figure is implied: the
   * write routes store 100 % or 0 % (`deal-derived.ts`), so the field is
   * locked on those stages.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.probability",
    type: new DefaultDataTypes.PercentageType({ step: 0.05 }),
    filterable: true,
    defaultValue: 0.1,
    size: 110,
    disabledWhen: { field: "stage", in: ["won", "lost"] },
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare probability: number;

  /**
   * Amount × probability, stored with the deal (`deal-derived.ts` keeps it in
   * step on every write, and explains why it is not `@Computed`) so it lists,
   * sorts and sums in the pipeline footer. Hidden on creation, when there is
   * nothing to show yet, and shown read-only once the deal exists.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.weightedAmount",
    type: new DefaultDataTypes.PriceType(),
    validate: false,
    size: 130,
    readonlyBehavior: { new: ReadonlyBehaviorType.hidden },
  })
  @Access(AccessMode.ReadOnly)
  declare weightedAmount: number;

  /**
   * Whether the deal is neither won nor lost, stored with the deal
   * (`deal-derived.ts` keeps it in step): a list filter takes one value per
   * column, so the saved views ("Big deals", "Stalled"…) narrow the open deals
   * through this flag.
   */
  @Listable()
  @Column({
    name: "$helio.crm.deals.columns.isOpen",
    type: new DefaultDataTypes.BooleanType(),
    validate: false,
    filterable: true,
    isVisible: false,
    readonlyBehavior: ReadonlyBehaviorType.hidden,
  })
  @Access(AccessMode.ReadOnly)
  declare isOpen: boolean;

  /** The sales rep who owns the deal; only sales reps can be picked. */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.owner",
    type: new DefaultDataTypes.RelationType({
      dataApiController: salesRepController,
      keyMapping: { label: "name", value: "_id", avatar: "avatar" },
      placeholder: "$helio.crm.deals.placeholders.owner",
    }),
    filterable: true,
    size: 190,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare owner: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.source",
    type: new DefaultDataTypes.SelectType({ items: [...LEAD_SOURCES] }),
    filterable: true,
    defaultValue: "website",
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare source: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.expectedClose",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      style: "day",
      soonWithinMs: 7 * DAY_MS,
      soonTone: "warning",
    }),
    size: 150,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare expectedClose: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.lastActivityAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      nowWithinMs: 60 * 60 * 1000,
      nowLabel: "$helio.crm.deals.activeNow",
    }),
    size: 150,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare lastActivityAt: Date;

  /**
   * The deal's next step. The kick-off call a signed quote planned reads in
   * the reader's language, in the form and the quick view too; a next step
   * typed over it replaces it (`afterDealEdit`).
   */
  @Searchable()
  @Listable(["nextStep", "kickoffQuote"])
  @Column({
    name: "$helio.crm.deals.columns.nextStep",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.crm.deals.placeholders.nextStep",
      maxLength: 160,
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  get nextStep(): string | undefined {
    const { nextStep, kickoffQuote } = this.table;
    return kickoffQuote
      ? kickoffNextStep(kickoffQuote, this.reader?.language)
      : nextStep;
  }
  set nextStep(value: string | undefined) {
    if (isKickoffNextStep(value, this.table.kickoffQuote)) return;
    this.table.nextStep = value;
  }

  /** Why a lost deal was lost: shown, and mandatory, on that stage only. */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.deals.columns.lostReason",
    type: new DefaultDataTypes.SelectType({
      items: [...LOST_REASONS],
      deselectable: true,
    }),
    filterable: true,
    isVisible: false,
    visibleWhen: { field: "stage", in: ["lost"] },
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare lostReason: string;

  /**
   * The line under the title: the next step, in orange once an open deal
   * stalls. The kick-off call a signed quote plans is written in the reader's
   * language.
   */
  @Listable(["nextStep", "kickoffQuote", "stage", "lastActivityAt"])
  @Access(AccessMode.ReadOnly)
  get nextStepLine(): CellSubline | null {
    const { nextStep, kickoffQuote, stage, lastActivityAt } = this.table;
    const text = kickoffQuote
      ? {
          key: "$helio.crm.deals.kickoffNextStep",
          params: { number: kickoffQuote },
        }
      : nextStep;
    if (!text) return null;
    const idleMs = lastActivityAt ? helioNow() - lastActivityAt.getTime() : 0;
    const stalled =
      OPEN_DEAL_STAGES.includes(stage) && idleMs > STALLED_DAYS * DAY_MS;
    return { text, tone: stalled ? "warning" : undefined };
  }

  /** The line under the stage pill: why a lost deal was lost. */
  @Listable(["stage", "lostReason"])
  @Access(AccessMode.ReadOnly)
  get stageDetail(): string | null {
    const { stage, lostReason } = this.table;
    if (stage !== "lost" || !lostReason) return null;
    return LOST_REASON_LABELS.get(lostReason) ?? null;
  }
}

/**
 * The deal controller, typed as `ControllerClass` for the relation columns of
 * other domains (see the TS2742 note on the class).
 */
export type DealRow = { [Field in keyof dealDataAPI]: dealDataAPI[Field] };

export const dealController: ControllerClass<DealRow> = dealDataAPI;
