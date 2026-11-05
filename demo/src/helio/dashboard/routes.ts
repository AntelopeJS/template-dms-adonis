import { Controller, Get, Parameter } from "@antelopejs/interface-api";
import { AuthUser } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import { overdueInvoicesBanner } from "../finance/banner";
import { activityFeed, offlineSitesBanner } from "./activity";
import {
  installations,
  newTicketsKpi,
  ticketHeatmap,
} from "./operations-metrics";
import { PageHelioDashboard } from "./page";
import { readerLanguage } from "./locale";
import { readPeriod } from "./period";
import {
  conversionKpi,
  productMix,
  revenueKpi,
  revenueTrend,
  signedQuotesKpi,
} from "./sales-metrics";
import { snapshot, shortcuts } from "./snapshot";
import { topReps } from "./team-metrics";

/**
 * The data routes of the dashboard. A plain controller wrapped by no page,
 * so it is gated explicitly on the dashboard page's permission: whoever may
 * open the dashboard may read its figures, nobody else. The period comes as
 * the query parameters every period-scoped block sends.
 */
@AuthUserWithPermission(PageHelioDashboard)
export class HelioDashboardApi extends Controller("/api/helio/dashboard") {
  @Parameter("from", "query") declare from?: string;
  @Parameter("to", "query") declare to?: string;
  @Parameter("compareFrom", "query") declare compareFrom?: string;
  @Parameter("compareTo", "query") declare compareTo?: string;

  private get period() {
    return readPeriod(this);
  }

  @Get("kpi/revenue")
  revenue() {
    return revenueKpi(this.period);
  }

  @Get("kpi/signed")
  signed() {
    return signedQuotesKpi(this.period);
  }

  @Get("kpi/conversion")
  conversion() {
    return conversionKpi(this.period);
  }

  @Get("kpi/tickets")
  tickets() {
    return newTicketsKpi(this.period);
  }

  @Get("revenue-trend")
  revenueTrend() {
    return revenueTrend(this.period);
  }

  @Get("product-mix")
  productMix(@AuthUser() user: User) {
    return productMix(this.period, readerLanguage(user.language));
  }

  @Get("installations")
  installations(@AuthUser() user: User) {
    return installations(this.period, readerLanguage(user.language));
  }

  @Get("top-reps")
  topReps() {
    return topReps(this.period);
  }

  @Get("ticket-heatmap")
  ticketHeatmap(@AuthUser() user: User) {
    return ticketHeatmap(this.period, readerLanguage(user.language));
  }

  @Get("activity")
  activity() {
    return activityFeed(this.period);
  }

  @Get("offline-sites")
  offlineSites() {
    return offlineSitesBanner();
  }

  /** Same readers as the snapshot, which already counts the overdue invoices. */
  @Get("overdue-invoices")
  overdueInvoices() {
    return overdueInvoicesBanner();
  }

  @Get("snapshot")
  snapshot() {
    return snapshot();
  }

  @Get("shortcuts")
  shortcuts() {
    return shortcuts();
  }
}
