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
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";
import {
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { customerController } from "../crm/controller";
import { quoteController } from "../sales/controller";
import { DAY_MS } from "../shared/seed";
import { teamController } from "../team/controller";
import { Project, ProjectModel } from "./database";
import { withoutCodeOnDuplicate, withProjectCode } from "./project-rules";
import { projectTaskCounts } from "./task-counts";

/** What Helio installs. Exported for the tabs, filters and charts. */
export const PROJECT_TYPES = [
  {
    value: "residential_pv",
    label: "$helio.projects.types.residentialPv",
    icon: "i-ph-house-line",
    iconColor: "primary",
    textColor: "primary",
  },
  {
    value: "commercial_pv",
    label: "$helio.projects.types.commercialPv",
    icon: "i-ph-factory",
    iconColor: "secondary",
    textColor: "secondary",
  },
  {
    value: "battery",
    label: "$helio.projects.types.battery",
    icon: "i-ph-battery-charging",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "ev_charger",
    label: "$helio.projects.types.evCharger",
    icon: "i-ph-charging-station",
    iconColor: "info",
    textColor: "info",
  },
] as const;

/** A project's progress, in order. Exported for the kanban, tabs and views. */
export const PROJECT_STATUSES = [
  {
    value: "planned",
    label: "$helio.projects.statuses.planned",
    icon: "i-ph-calendar-blank",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "scheduled",
    label: "$helio.projects.statuses.scheduled",
    icon: "i-ph-calendar-check",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "in_progress",
    label: "$helio.projects.statuses.inProgress",
    icon: "i-ph-hard-hat",
    iconColor: "primary",
    textColor: "primary",
  },
  {
    value: "inspection",
    label: "$helio.projects.statuses.inspection",
    icon: "i-ph-clipboard-text",
    iconColor: "secondary",
    textColor: "secondary",
  },
  {
    value: "done",
    label: "$helio.projects.statuses.done",
    icon: "i-ph-check-circle",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "on_hold",
    label: "$helio.projects.statuses.onHold",
    icon: "i-ph-pause-circle",
    iconColor: "warning",
    textColor: "warning",
  },
] as const;

/**
 * The data controller of the projects table. It is not exported on purpose:
 * emitting a .d.ts for this class would require naming types from the nested
 * @antelopejs/interface-core copies (TS2742), so `projectController` is the
 * handle other modules use.
 */
@RegisterDataController()
class projectDataAPI extends DataController(
  Project,
  {
    ...TableViewRoutes.All,
    new: withProjectCode(TableViewRoutes.New),
    get: withoutCodeOnDuplicate(TableViewRoutes.Get),
  },
  Controller("/api/helio/projects"),
) {
  @ModelReference()
  @Model(ProjectModel)
  declare model: ProjectModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  /**
   * Left empty on a new project, it takes the next code; the list page's
   * guards refuse a code already used (see project-rules.ts).
   */
  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.code",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.projects.placeholders.code",
      maxLength: 12,
    }),
    filterable: true,
    display: new DefaultDisplays.MonoDisplay({ copy: true }),
    size: 110,
  })
  @Mandatory("edit")
  @Access(AccessMode.ReadWrite)
  declare code: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.name",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.projects.placeholders.name",
      maxLength: 160,
    }),
    filterable: true,
    size: 300,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare name: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.projects.placeholders.customer",
    }),
    filterable: true,
    size: 200,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  /**
   * The quote the project carries out. The picker lists the chosen customer's
   * quotes only; the write routes still refuse another customer's quote
   * (`assertQuoteOfCustomer`).
   */
  @Listable()
  @Column({
    name: "$helio.projects.columns.quote",
    type: new DefaultDataTypes.RelationType({
      dataApiController: quoteController,
      keyMapping: { label: "number", value: "_id" },
      placeholder: "$helio.projects.placeholders.quote",
      deselectable: true,
      filterBy: { field: "customer", from: "customer" },
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare quote: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.type",
    type: new DefaultDataTypes.SelectType({ items: [...PROJECT_TYPES] }),
    filterable: true,
    defaultValue: "residential_pv",
    size: 170,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare type: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.status",
    type: new DefaultDataTypes.SelectType({ items: [...PROJECT_STATUSES] }),
    filterable: true,
    defaultValue: "planned",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        planned: "neutral",
        scheduled: "info",
        in_progress: "primary",
        inspection: "secondary",
        done: "success",
        on_hold: "warning",
      },
      liveValues: ["in_progress"],
    }),
    size: 160,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare status: string;

  /**
   * The task bar: done over all tasks, read by the two getters below. It is not
   * a `@Computed` field: on this controller one made the `get` route answer
   * null for every single relation (customer, quote, lead technician), and the
   * TableView list leaves out a computed field it neither sorts nor filters
   * on. The column holds no value of its own, so it is hidden from the forms.
   */
  @Listable()
  @Column({
    name: "$helio.projects.columns.progress",
    type: new DefaultDataTypes.NumberType({ min: 0 }),
    validate: false,
    readonlyBehavior: ReadonlyBehaviorType.hidden,
    display: new DefaultDisplays.ProgressDisplay({
      doneField: "progressDone",
      totalField: "progressTotal",
    }),
    size: 150,
  })
  @Access(AccessMode.ReadOnly)
  declare tasksDone: number;

  /** The tasks done, from the task counts of the row, read once for both getters. */
  @Listable(["_id"])
  @Access(AccessMode.ReadOnly)
  get progressDone(): Promise<number> {
    return projectTaskCounts(this.table).then((counts) => counts.done);
  }

  /** The tasks of the project, from the same read as `progressDone`. */
  @Listable(["_id"])
  @Access(AccessMode.ReadOnly)
  get progressTotal(): Promise<number> {
    return projectTaskCounts(this.table).then((counts) => counts.total);
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.plannedStart",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      style: "day",
      soonWithinMs: 7 * DAY_MS,
      soonTone: "warning",
    }),
    size: 140,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare plannedStart: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.plannedEnd",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    size: 140,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare plannedEnd: Date;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.leadTechnician",
    type: new DefaultDataTypes.RelationType({
      dataApiController: teamController,
      keyMapping: { label: "name", value: "_id", avatar: "avatar" },
      placeholder: "$helio.projects.placeholders.leadTechnician",
      deselectable: true,
    }),
    filterable: true,
    size: 190,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare leadTechnician: string;

  @Listable()
  @Column({
    name: "$helio.projects.columns.crew",
    type: new DefaultDataTypes.RelationType({
      dataApiController: teamController,
      keyMapping: { label: "name", value: "_id", avatar: "avatar" },
      placeholder: "$helio.projects.placeholders.crew",
      multiple: true,
    }),
    filterable: true,
    display: new DefaultDisplays.PillsDisplay({ labelKey: "name" }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare crew: string[];

  /** Helio installs in Belgium, so the country is filled in (it is required). */
  @Listable()
  @Column({
    name: "$helio.projects.columns.address",
    type: new DefaultDataTypes.AddressType({
      autocomplete: { enabled: true, lang: "fr" },
      defaultCountry: "BE",
    }),
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare address: DefaultDataTypes.Address;

  /** A battery or a charger has no peak power, left empty and shown as a dash. */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.capacityKwp",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 0.1,
      suffix: "$helio.projects.units.kwp",
      width: "compact",
      fallback: "—",
    }),
    filterable: true,
    size: 140,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare capacityKwp: number;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.projects.columns.budget",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 155,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare budget: number;

  @Column({
    name: "$helio.projects.columns.notes",
    type: new DefaultDataTypes.StringType({
      textarea: true,
      rows: 4,
      placeholder: "$helio.projects.placeholders.notes",
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare notes: string;
}

/** The projects controller as relations and pages reference it (see the TS2742 note on the class). */
export type ProjectRow = {
  [Field in keyof projectDataAPI]: projectDataAPI[Field];
};
export const projectController: ControllerClass<ProjectRow> = projectDataAPI;
