import {
  Context,
  Get,
  HTTPResult,
  Parameter,
  type RequestContext,
} from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { ChartArea, ChartHeatmap } from "@antelopejs/interface-dms/base/chart";
import { ChartCard } from "@antelopejs/interface-dms/base/chart-card";
import { Card } from "@antelopejs/interface-dms/base/card";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { LiveToggle } from "@antelopejs/interface-dms/base/live-toggle";
import { Meter } from "@antelopejs/interface-dms/base/meter";
import { PeriodSelector } from "@antelopejs/interface-dms/base/period-selector";
import { HStack, Spacer } from "@antelopejs/interface-dms/base/stack";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { TopListCard } from "@antelopejs/interface-dms/base/top-list-card";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { helioCategory } from "../category";
import { ProjectModel } from "../projects/database";
import { heatmapSeries, productionCard, topProducers } from "./charts";
import { SiteModel } from "./database";
import { type FleetSite, loadFleet } from "./fleet";
import {
  MONITORING_PAGE_PATH,
  monitoringRoute,
  PERIOD_SCOPE,
  TELEMETRY_TOPIC,
} from "./links";
import { readPeriod } from "./period";
import { siteRow, siteRows } from "./rows";
import {
  capacityMeter,
  fleetStats,
  lostCapacityMeter,
  siteRecord,
} from "./stats";
import { fleetTable } from "./table";
import { helioNow } from "../shared/clock";

/** The instant a held table froze its rows at, else now. */
function heldAt(query: URLSearchParams): number {
  const held = Date.parse(query.get("liveHeldAt") ?? "");
  return Number.isFinite(held) ? held : helioNow();
}

async function findSite(id: string): Promise<FleetSite> {
  const site = (await loadFleet()).find((entry) => entry.id === id);
  if (!site) {
    throw new HTTPResult(404, {
      message: "$helio.monitoring.errors.siteNotFound",
    });
  }
  return site;
}

/**
 * The operations room of the fleet: what the installed sites produce right now
 * and over the period, which inverters need someone, and every site with its
 * live reading. A live page: each round of inverter reports (the simulator
 * publishes one every 10 seconds) refreshes the blocks, at most every 10
 * seconds, every minute once the period spans a week; the L key pauses. Every
 * route below sits on the page class, so it shares the page's access.
 */
@RegisterPage()
export class PageHelioMonitoring extends PageController(
  "monitoring",
  {
    displayName: "$helio.monitoring.title",
    description: "$helio.monitoring.description",
    icon: "i-ph-solar-panel",
    category: helioCategory,
    order: 4,
    live: { maxRate: 10, slowRateAfter: { period: "7d", maxRate: 60 } },
  },
  DefaultLayout(),
) {
  static toolbar = HStack({ alignment: "center", spacing: "12px" })
    .child(
      "live",
      LiveToggle({
        variant: "pill",
        missedLabel: "$helio.monitoring.live.missed",
      }),
    )
    .child("spacer", Spacer())
    .child(
      "period",
      PeriodSelector({
        id: PERIOD_SCOPE,
        defaultPreset: "today",
        defaultComparison: "previous-period",
        presets: [
          "last-24h",
          "today",
          "yesterday",
          "last-7-days",
          "last-30-days",
          "this-month",
        ],
        comparisons: ["none", "previous-period", "previous-year"],
        align: "right",
        showRangeLabel: true,
      }),
    );

  /**
   * The stat strip. Its sidebar badge warns while an inverter is silent: the
   * count of offline sites, in the warning tone, counted on each page visit.
   */
  static stats = StatGroup({
    label: "$helio.monitoring.stats.label",
    layout: "cards",
    columns: 4,
    fetchUrl: monitoringRoute("/stats"),
    realtimeTopic: TELEMETRY_TOPIC,
  }).navBadge({
    count: async () => {
      const offline = await GetModel(SiteModel).getBy(
        "inverterStatus",
        "offline",
      );
      return { count: offline.length, tone: "warning" };
    },
  });

  static overview = Grid({ gap: "1rem", minColumnWidth: "300px" }).child(
    "row",
    GridRow()
      .child(
        "production",
        ChartCard({
          title: "$helio.monitoring.production.title",
          description: "$helio.monitoring.production.description",
          icon: "i-ph-chart-line-up",
          fetchUrl: monitoringRoute("/production"),
          periodScope: PERIOD_SCOPE,
          realtimeTopic: TELEMETRY_TOPIC,
          valueFormat: "number",
          valuePrecision: 0,
          showDelta: true,
          showLegend: true,
          primaryLabel: "$helio.monitoring.production.primaryLabel",
          comparisonLabel: "$helio.monitoring.production.comparisonLabel",
          chart: ChartArea({
            xaxisType: "datetime",
            smooth: true,
            comparisonStyle: "dashed",
            fillOpacity: 0.3,
            color: "warning",
            height: "260px",
          }),
        }),
        { colSpan: 2 },
      )
      .child(
        "health",
        Card({
          title: "$helio.monitoring.health.title",
          description: "$helio.monitoring.health.description",
        })
          .child(
            "output",
            Meter({
              label: "$helio.monitoring.meters.output",
              format: "percent",
              size: "md",
              fetchUrl: monitoringRoute("/meters/output"),
              realtimeTopic: TELEMETRY_TOPIC,
            }),
          )
          .child(
            "attention",
            Meter({
              label: "$helio.monitoring.meters.attention",
              format: "percent",
              size: "md",
              warnAt: 5,
              errorAt: 15,
              fetchUrl: monitoringRoute("/meters/lost"),
              realtimeTopic: TELEMETRY_TOPIC,
              actions: [
                {
                  label: "$helio.monitoring.meters.attentionAction",
                  to: `${MONITORING_PAGE_PATH}?table.tab=offline`,
                },
              ],
            }),
          ),
      ),
  );

  static patterns = Grid({ gap: "1rem", minColumnWidth: "300px" }).child(
    "row",
    GridRow()
      .child(
        "heatmap",
        ChartHeatmap({
          title: "$helio.monitoring.heatmap.title",
          description: "$helio.monitoring.heatmap.description",
          fetchUrl: monitoringRoute("/heatmap"),
          realtimeTopic: TELEMETRY_TOPIC,
          color: "warning",
          shadeIntensity: 0.6,
          height: "280px",
        }),
        { colSpan: 2 },
      )
      .child(
        "top",
        TopListCard({
          title: "$helio.monitoring.top.title",
          description: "$helio.monitoring.top.description",
          fetchUrl: monitoringRoute("/top"),
          periodScope: PERIOD_SCOPE,
          realtimeTopic: TELEMETRY_TOPIC,
          valueFormat: "number",
          valuePrecision: 0,
          showRank: true,
          showDelta: true,
          showSparkline: true,
          sparklineAccent: "warning",
          skeletonCount: 5,
          emptyLabel: "$helio.monitoring.top.empty",
        }),
      ),
  );

  static table = fleetTable;

  @Get("stats")
  async stats() {
    return fleetStats(await loadFleet(), helioNow());
  }

  @Get("production")
  async production(@Context() ctx: RequestContext) {
    const now = helioNow();
    return productionCard(
      await loadFleet(),
      readPeriod(ctx.url.searchParams, now),
      now,
    );
  }

  @Get("meters/output")
  async outputMeter() {
    return capacityMeter(await loadFleet(), helioNow());
  }

  @Get("meters/lost")
  async lostCapacity() {
    return lostCapacityMeter(await loadFleet());
  }

  @Get("heatmap")
  async heatmap() {
    return heatmapSeries(await loadFleet(), helioNow());
  }

  @Get("top")
  async top(@Context() ctx: RequestContext) {
    const now = helioNow();
    return topProducers(
      await loadFleet(),
      readPeriod(ctx.url.searchParams, now),
      now,
    );
  }

  @Get("sites")
  async sites(@Context() ctx: RequestContext) {
    const query = ctx.url.searchParams;
    const now = heldAt(query);
    return siteRows(await loadFleet(), query, readPeriod(query, now), now);
  }

  @Get("sites/:id")
  async site(@Parameter("id", "param") id: string) {
    const now = helioNow();
    return siteRow(
      await findSite(id),
      readPeriod(new URLSearchParams(), now),
      now,
    );
  }

  @Get("sites/:id/facts")
  async facts(@Parameter("id", "param") id: string) {
    const site = await findSite(id);
    const project = site.project
      ? await GetModel(ProjectModel).get(site.project)
      : undefined;
    return siteRecord(site, helioNow(), project?.code ?? null);
  }
}
