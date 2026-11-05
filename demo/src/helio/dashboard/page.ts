import { ActivityFeed } from "@antelopejs/interface-dms/base/activity-feed";
import { Banner } from "@antelopejs/interface-dms/base/banner";
import {
  ChartArea,
  ChartColumn,
  ChartDonut,
  ChartHeatmap,
} from "@antelopejs/interface-dms/base/chart";
import { ChartCard } from "@antelopejs/interface-dms/base/chart-card";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { KpiCard } from "@antelopejs/interface-dms/base/kpi-card";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { NavCardGrid } from "@antelopejs/interface-dms/base/nav-card-grid";
import { PeriodSelector } from "@antelopejs/interface-dms/base/period-selector";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { TopListCard } from "@antelopejs/interface-dms/base/top-list-card";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { helioCategory } from "../category";
import { HELIO_PAGES } from "./links";
import { ACTIVITY_TOPIC } from "./log";

/** One scope for the whole page: every card follows the period selector. */
const SCOPE = "helio";
const API = "/api/helio/dashboard";
const COMPARE_LABEL = "$helio.dashboard.compareLabel";

/**
 * The manager's cockpit: what was sold, installed and billed over the
 * period, what is happening right now, and where to act. Every block reads
 * its own route under /api/helio/dashboard, computed from the collections
 * the other Helio pages list.
 */
@RegisterPage()
export class PageHelioDashboard extends PageController(
  "dashboard",
  {
    displayName: "$helio.dashboard.title",
    description: "$helio.dashboard.description",
    icon: "i-ph-gauge",
    category: helioCategory,
    order: 0,
  },
  DefaultLayout(),
) {
  static period = PeriodSelector({
    id: SCOPE,
    defaultPreset: "last-90-days",
    defaultComparison: "previous-period",
    presets: [
      "last-30-days",
      "last-90-days",
      "this-month",
      "last-month",
      "this-quarter",
      "last-quarter",
      "ytd",
      "custom",
    ],
    comparisons: ["none", "previous-period", "previous-year"],
    align: "right",
    showRangeLabel: true,
    rememberKey: "helio",
  });

  /** Shown by the server only while installed sites are offline. */
  static alerts = Banner({ fetchUrl: `${API}/offline-sites` });
  static overdue = Banner({ fetchUrl: `${API}/overdue-invoices` });

  static now = StatGroup({
    label: "$helio.dashboard.snapshot.label",
    layout: "joined",
    columns: 4,
    fetchUrl: `${API}/snapshot`,
  });

  /**
   * The period KPIs. The tickets card inverts its delta, since fewer new
   * tickets is the good direction.
   */
  static kpis = Grid({ gap: "1rem", minColumnWidth: "220px" }).child(
    "row",
    GridRow()
      .child(
        "revenue",
        KpiCard({
          title: "$helio.dashboard.kpis.revenue",
          description: "$helio.dashboard.kpis.revenueDescription",
          icon: "i-ph-currency-eur",
          fetchUrl: `${API}/kpi/revenue`,
          periodScope: SCOPE,
          valueFormat: "currency",
          currencyCode: "EUR",
          showDelta: true,
          showSparkline: true,
          compareLabel: COMPARE_LABEL,
        }),
      )
      .child(
        "signed",
        KpiCard({
          title: "$helio.dashboard.kpis.signed",
          description: "$helio.dashboard.kpis.signedDescription",
          icon: "i-ph-seal-check",
          fetchUrl: `${API}/kpi/signed`,
          periodScope: SCOPE,
          valueFormat: "currency",
          currencyCode: "EUR",
          showDelta: true,
          showSparkline: true,
          compareLabel: COMPARE_LABEL,
        }),
      )
      .child(
        "conversion",
        KpiCard({
          title: "$helio.dashboard.kpis.conversion",
          description: "$helio.dashboard.kpis.conversionDescription",
          icon: "i-ph-target",
          fetchUrl: `${API}/kpi/conversion`,
          periodScope: SCOPE,
          valueFormat: "percent",
          showDelta: true,
          showSparkline: true,
          compareLabel: COMPARE_LABEL,
        }),
      )
      .child(
        "tickets",
        KpiCard({
          title: "$helio.dashboard.kpis.tickets",
          description: "$helio.dashboard.kpis.ticketsDescription",
          icon: "i-ph-lifebuoy",
          fetchUrl: `${API}/kpi/tickets`,
          periodScope: SCOPE,
          valueFormat: "number",
          invert: true,
          showDelta: true,
          showSparkline: true,
          compareLabel: COMPARE_LABEL,
        }),
      ),
  );

  /**
   * The period charts. The ticket heatmap shows no delta, since more tickets
   * is not good news and the card cannot invert. Its single colour is shaded
   * by value: given several, the heatmap would colour its value ranges with a
   * multi-hue palette. The activity feed also refreshes on `ACTIVITY_TOPIC`,
   * so what users do elsewhere (a quote accepted, a ticket resolved) shows up
   * without a reload.
   */
  static charts = Grid({ gap: "1rem", minColumnWidth: "300px" })
    .child(
      "sales",
      GridRow()
        .child(
          "revenueTrend",
          ChartCard({
            title: "$helio.dashboard.revenueTrend.title",
            description: "$helio.dashboard.revenueTrend.description",
            icon: "i-ph-chart-line-up",
            fetchUrl: `${API}/revenue-trend`,
            periodScope: SCOPE,
            valueFormat: "currency",
            currencyCode: "EUR",
            showDelta: true,
            showLegend: true,
            primaryLabel: "$helio.dashboard.revenueTrend.current",
            comparisonLabel: "$helio.dashboard.revenueTrend.previous",
            chart: ChartArea({
              height: "280px",
              smooth: true,
              fillOpacity: 0.3,
              comparisonStyle: "dashed",
              xaxisType: "datetime",
            }),
          }),
          { colSpan: 2 },
        )
        .child(
          "productMix",
          ChartCard({
            title: "$helio.dashboard.productMix.title",
            description: "$helio.dashboard.productMix.description",
            icon: "i-ph-chart-donut",
            fetchUrl: `${API}/product-mix`,
            periodScope: SCOPE,
            valueFormat: "currency",
            currencyCode: "EUR",
            showDelta: true,
            showLegend: false,
            showSeriesLegend: true,
            chart: ChartDonut({ height: "280px", legendPosition: "bottom" }),
          }),
        ),
    )
    .child(
      "operations",
      GridRow()
        .child(
          "installations",
          ChartCard({
            title: "$helio.dashboard.installations.title",
            description: "$helio.dashboard.installations.description",
            icon: "i-ph-hard-hat",
            fetchUrl: `${API}/installations`,
            periodScope: SCOPE,
            valueFormat: "number",
            showDelta: true,
            showLegend: false,
            showSeriesLegend: true,
            chart: ChartColumn({
              height: "280px",
              stacked: true,
              roundedCorners: true,
              columnWidth: 55,
              legendPosition: "top",
            }),
          }),
          { colSpan: 2 },
        )
        .child(
          "topReps",
          TopListCard({
            title: "$helio.dashboard.topReps.title",
            description: "$helio.dashboard.topReps.description",
            fetchUrl: `${API}/top-reps`,
            periodScope: SCOPE,
            valueFormat: "currency",
            currencyCode: "EUR",
            showRank: true,
            highlightTopN: 1,
            showDelta: true,
            showBar: true,
            skeletonCount: 3,
            emptyLabel: "$helio.dashboard.topReps.empty",
            actions: [
              {
                label: "$helio.dashboard.topReps.action",
                to: HELIO_PAGES.pipeline,
                icon: "i-ph-arrow-right",
              },
            ],
          }),
        ),
    )
    .child(
      "service",
      GridRow()
        .child(
          "ticketHeatmap",
          ChartCard({
            title: "$helio.dashboard.ticketHeatmap.title",
            description: "$helio.dashboard.ticketHeatmap.description",
            icon: "i-ph-calendar-dots",
            fetchUrl: `${API}/ticket-heatmap`,
            periodScope: SCOPE,
            valueFormat: "number",
            showDelta: false,
            showLegend: false,
            chart: ChartHeatmap({
              height: "320px",
              color: "primary",
              shadeIntensity: 0.7,
            }),
          }),
          { colSpan: 2 },
        )
        .child(
          "activity",
          ActivityFeed({
            title: "$helio.dashboard.activity.title",
            fetchUrl: `${API}/activity`,
            realtimeTopic: ACTIVITY_TOPIC,
            periodScope: SCOPE,
            groupByDay: true,
            maxItems: 12,
            visibleItems: 7,
            fillHeight: true,
          }),
        ),
    );

  static shortcuts = NavCardGrid({
    title: "$helio.dashboard.shortcuts.title",
    description: "$helio.dashboard.shortcuts.description",
    columns: 4,
    fetchUrl: `${API}/shortcuts`,
  });
}
