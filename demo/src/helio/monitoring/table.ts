import type { DataType } from "@antelopejs/interface-dms/base/data-types";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Form } from "@antelopejs/interface-dms/base/form";
import {
  DefaultDisplays,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import { LOCALITIES } from "../crm/seed-data";
import { INVERTER_STATUSES } from "./controller";
import { monitoringRoute, PERIOD_SCOPE, TELEMETRY_TOPIC } from "./links";

/** A report within the last minute reads "Live". */
const LIVE_WITHIN_MS = 60 * 1000;

/** One tab per inverter state, worded and coloured as the status column. */
const statusTabs = INVERTER_STATUSES.map((status) => ({
  id: status.value,
  label: status.label,
  icon: status.icon,
  iconColor: status.iconColor,
  filter: { accessorKey: "inverterStatus", mode: "is", value: status.value },
}));

/**
 * The towns Helio installs in, offered by the city quick filter: a quick
 * filter lists the options of a select, which a free-text column has none of.
 * A site whose customer lives elsewhere still shows its city, drawn as
 * written; it is only missing from the filter.
 */
const CITIES = [...new Set(LOCALITIES.map(({ city }) => city))]
  .sort((a, b) => a.localeCompare(b, "fr"))
  .map((city) => ({ value: city, label: city }));

const fact = (id: string, label: string, type: DataType) => ({
  id,
  label,
  type,
  readonly: true,
});

const factGroup = (
  id: string,
  label: string,
  description: string,
  fields: ReturnType<typeof fact>[],
) => ({ id, label, description, orientation: "vertical" as const, fields });

/**
 * The drawer of a site: its facts, read for the row it opens on (clicked, or
 * named by `?record=<site id>`) and shown as the other Helio drawers show a
 * record, a read-only form in titled parts. The drawer mounts one block and a
 * container's children are not rendered there, so the site's own production
 * chart stays out of it.
 */
const sitePanel = Form({
  fetchUrl: monitoringRoute("/sites/{{row.id}}/facts"),
  saveMode: "none",
  requiresRecord: true,
  fields: [
    factGroup(
      "site",
      "$helio.monitoring.facts.groups.site.label",
      "$helio.monitoring.facts.groups.site.description",
      [
        fact(
          "customer",
          "$helio.monitoring.facts.customer",
          new DefaultDataTypes.StringType(),
        ),
        fact(
          "city",
          "$helio.monitoring.facts.city",
          new DefaultDataTypes.StringType(),
        ),
        fact(
          "commissionedAt",
          "$helio.monitoring.facts.commissioned",
          new DefaultDataTypes.DateType(),
        ),
        fact(
          "project",
          "$helio.monitoring.facts.project",
          new DefaultDataTypes.StringType(),
        ),
      ],
    ),
    factGroup(
      "inverter",
      "$helio.monitoring.facts.groups.inverter.label",
      "$helio.monitoring.facts.groups.inverter.description",
      [
        fact(
          "status",
          "$helio.monitoring.facts.status",
          new DefaultDataTypes.SelectType({ items: [...INVERTER_STATUSES] }),
        ),
        fact(
          "sinceLastReport",
          "$helio.monitoring.facts.sinceLastReport",
          new DefaultDataTypes.StringTimeType(),
        ),
      ],
    ),
    factGroup(
      "production",
      "$helio.monitoring.facts.groups.production.label",
      "$helio.monitoring.facts.groups.production.description",
      [
        fact(
          "capacityKwp",
          "$helio.monitoring.facts.capacity",
          new DefaultDataTypes.NumberType({
            suffix: "$helio.monitoring.units.kwp",
          }),
        ),
        fact(
          "powerKw",
          "$helio.monitoring.facts.power",
          new DefaultDataTypes.NumberType({
            suffix: "$helio.monitoring.units.kw",
          }),
        ),
        fact(
          "todayKwh",
          "$helio.monitoring.facts.today",
          new DefaultDataTypes.NumberType({
            suffix: "$helio.monitoring.units.kwh",
          }),
        ),
        fact(
          "yieldKwhPerKwp",
          "$helio.monitoring.facts.yield",
          new DefaultDataTypes.NumberType({
            suffix: "$helio.monitoring.units.yield",
          }),
        ),
      ],
    ),
  ],
});

/**
 * Sized to fit a 1440 px screen with the sidebar open: figures are written by
 * the server as composed texts (`"1 712,2 kWh"`), grouped and with their unit,
 * so a narrow cell never cuts a number, and headers are one short word (their
 * description says the rest). The city (a quick filter) and the last report
 * (under the pill of an offline inverter) start hidden.
 */
const columns = {
  name: {
    name: "$helio.monitoring.table.columns.site",
    type: new DefaultDataTypes.StringType(),
    display: new DefaultDisplays.IdentityDisplay({
      icon: "i-ph-solar-panel",
      subtitleField: "customerName",
    }),
    sortable: true,
    size: 205,
    order: 1,
  },
  city: {
    name: "$helio.monitoring.table.columns.city",
    type: new DefaultDataTypes.SelectType({ items: CITIES }),
    display: new DefaultDisplays.TextDisplay(),
    sortable: true,
    isVisible: false,
    size: 130,
    order: 2,
  },
  inverterStatus: {
    name: "$helio.monitoring.table.columns.inverter",
    type: new DefaultDataTypes.SelectType({ items: [...INVERTER_STATUSES] }),
    display: new DefaultDisplays.StatusPillDisplay({
      tones: { online: "success", degraded: "warning", offline: "error" },
      liveValues: ["online"],
      subField: "statusDetail",
    }),
    sortable: true,
    size: 150,
    order: 3,
  },
  powerKw: {
    name: "$helio.monitoring.table.columns.power",
    description: "$helio.monitoring.table.columns.powerDescription",
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.TwoLineDisplay({
      primaryField: "powerLabel",
      subField: "powerShare",
    }),
    sortable: true,
    size: 150,
    order: 4,
  },
  capacityKwp: {
    name: "$helio.monitoring.table.columns.capacity",
    description: "$helio.monitoring.table.columns.capacityDescription",
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.TwoLineDisplay({
      primaryField: "capacityLabel",
    }),
    sortable: true,
    size: 135,
    order: 5,
  },
  periodKwh: {
    name: "$helio.monitoring.table.columns.period",
    description: "$helio.monitoring.table.columns.periodDescription",
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.TwoLineDisplay({
      primaryField: "periodLabel",
    }),
    sortable: true,
    size: 125,
    order: 6,
  },
  periodTrend: {
    name: "$helio.monitoring.table.columns.trend",
    description: "$helio.monitoring.table.columns.trendDescription",
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.SparklineDisplay({
      field: "trend",
      tone: "warning",
    }),
    size: 115,
    order: 7,
  },
  todayKwh: {
    name: "$helio.monitoring.table.columns.today",
    description: "$helio.monitoring.table.columns.todayDescription",
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.TwoLineDisplay({
      primaryField: "todayLabel",
    }),
    sortable: true,
    size: 155,
    order: 8,
  },
  lastSeenAt: {
    name: "$helio.monitoring.table.columns.lastSeen",
    type: new DefaultDataTypes.DateType(),
    display: new DefaultDisplays.RelativeDateDisplay({
      nowWithinMs: LIVE_WITHIN_MS,
      nowLabel: "$helio.monitoring.sites.liveNow",
      pastTone: "muted",
    }),
    sortable: true,
    isVisible: false,
    size: 130,
    order: 9,
  },
};

/**
 * The fleet table: every site with its live reading, read from the telemetry
 * route of the page (a source table, no data controller: the readings are
 * computed, not stored). Offline sites stay pinned on top, a click opens the
 * site in a right drawer made of blocks, and a paused page holds the rows.
 */
export const fleetTable = TableView.fromSource({
  caption: "$helio.monitoring.table.caption",
  fetchUrl: monitoringRoute("/sites"),
  fetchRowUrl: monitoringRoute("/sites/{{row.id}}"),
  periodScope: PERIOD_SCOPE,
  capabilities: { filter: true },
  columns,
  labelKey: "name",
  searchPlaceholder: "$helio.monitoring.table.search",
  searchShortcut: "/",
  rowClick: "single",
  pageSize: 20,
  defaultSort: { field: "powerKw", desc: true },
  pinnedRows: { field: "inverterStatus", equals: "offline" },
  tabs: statusTabs,
  quickFilters: [
    { field: "city", allLabel: "$helio.monitoring.table.allCities" },
  ],
  realtimeTopic: TELEMETRY_TOPIC,
  liveHold: {
    whileRowOpen: true,
    whileSearching: true,
    missedLabel: "$helio.monitoring.live.missed",
  },
  emptyStates: {
    firstRun: {
      title: "$helio.monitoring.table.empty.title",
      description: "$helio.monitoring.table.empty.description",
      icon: "i-ph-solar-panel",
    },
    filtered: {
      title: "$helio.monitoring.table.empty.filteredTitle",
      description: "$helio.monitoring.table.empty.filteredDescription",
      icon: "i-ph-funnel-x",
    },
  },
  footer: {
    countLabel: "$helio.monitoring.table.count",
    hint: "$helio.monitoring.table.hint",
  },
  rowActions: {
    menuLabel: "$helio.monitoring.table.menu",
    custom: [
      {
        label: "$helio.monitoring.table.actions.open",
        icon: "i-ph-sidebar-simple",
        isDefault: true,
        target: {
          type: "drawer",
          direction: "right",
          component: sitePanel,
          title: "$helio.monitoring.table.panel.title",
          rowTitle: "{name}",
          positionLabel: "$helio.monitoring.table.panel.position",
          deepLink: true,
          notFound: {
            title: "$helio.monitoring.table.panel.notFoundTitle",
            description: "$helio.monitoring.table.panel.notFoundDescription",
          },
        },
      },
      {
        label: "$helio.monitoring.table.actions.project",
        icon: "i-ph-hard-hat",
        target: {
          type: "page",
          url: "/helio/operations/project/{{row.project}}",
        },
      },
    ],
  },
});
