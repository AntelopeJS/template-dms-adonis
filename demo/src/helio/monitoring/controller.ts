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
import {
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { customerController } from "../crm/controller";
import { projectController } from "../projects/controller";
import { Site, SiteModel } from "./database";

/** What an inverter reports. Exported for the fleet page's tabs and filters. */
export const INVERTER_STATUSES = [
  {
    value: "online",
    label: "$helio.monitoring.inverterStatuses.online",
    icon: "i-ph-wifi-high",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "degraded",
    label: "$helio.monitoring.inverterStatuses.degraded",
    icon: "i-ph-warning",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "offline",
    label: "$helio.monitoring.inverterStatuses.offline",
    icon: "i-ph-wifi-slash",
    iconColor: "error",
    textColor: "error",
  },
] as const;

/** A site heard from this recently reads "Live". */
const LIVE_WITHIN_MS = 15 * 60 * 1000;

/**
 * The Data API controller of the monitored sites. Not exported on purpose:
 * emitting a .d.ts for this class would require naming types from the nested
 * `@antelopejs/interface-core` copies (TS2742), hence the `ControllerClass`
 * alias below.
 */
@RegisterDataController()
class siteDataAPI extends DataController(
  Site,
  TableViewRoutes.All,
  Controller("/api/helio/sites"),
) {
  @ModelReference()
  @Model(SiteModel)
  declare model: SiteModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.name",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.monitoring.sites.placeholders.name",
      maxLength: 120,
    }),
    filterable: true,
    display: new DefaultDisplays.IdentityDisplay({
      icon: "i-ph-solar-panel",
      subtitleField: "city",
    }),
    size: 260,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare name: string;

  @Searchable()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.city",
    type: new DefaultDataTypes.StringType({ maxLength: 80 }),
    filterable: true,
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare city: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.monitoring.sites.placeholders.customer",
    }),
    filterable: true,
    size: 200,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  @Listable()
  @Column({
    name: "$helio.monitoring.sites.columns.project",
    type: new DefaultDataTypes.RelationType({
      dataApiController: projectController,
      keyMapping: { label: "code", value: "_id" },
      placeholder: "$helio.monitoring.sites.placeholders.project",
      deselectable: true,
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare project: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.inverterStatus",
    type: new DefaultDataTypes.SelectType({ items: [...INVERTER_STATUSES] }),
    filterable: true,
    defaultValue: "online",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: { online: "success", degraded: "warning", offline: "error" },
      liveValues: ["online"],
    }),
    size: 140,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare inverterStatus: string;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.capacityKwp",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 0.1,
      suffix: "$helio.monitoring.units.kwp",
      width: "compact",
    }),
    filterable: true,
    size: 120,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare capacityKwp: number;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.todayKwh",
    type: new DefaultDataTypes.NumberType({
      min: 0,
      step: 0.1,
      suffix: "$helio.monitoring.units.kwh",
    }),
    filterable: true,
    size: 120,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare todayKwh: number;

  /** Daily production of the last seven days, oldest first (the sparkline). */
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare last7Days: number[];

  /** The week's production in kWh, drawn as the sparkline of its seven days. */
  @Listable(["last7Days"])
  @Column({
    name: "$helio.monitoring.sites.columns.last7Days",
    type: new DefaultDataTypes.NumberType({
      suffix: "$helio.monitoring.units.kwh",
    }),
    validate: false,
    display: new DefaultDisplays.SparklineDisplay({
      field: "last7Days",
      tone: "primary",
    }),
    size: 150,
  })
  @Access(AccessMode.ReadOnly)
  get weekKwh(): number {
    const days = this.table.last7Days ?? [];
    return Math.round(days.reduce((sum, value) => sum + value, 0) * 10) / 10;
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.lastSeenAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      nowWithinMs: LIVE_WITHIN_MS,
      nowLabel: "$helio.monitoring.sites.liveNow",
    }),
    size: 140,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare lastSeenAt: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.monitoring.sites.columns.commissionedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare commissionedAt: Date;
}

/** `ControllerClass`-typed alias for relations and pages (see the TS2742 note). */
export type SiteRow = { [Field in keyof siteDataAPI]: siteDataAPI[Field] };

export const siteController: ControllerClass<SiteRow> = siteDataAPI;
