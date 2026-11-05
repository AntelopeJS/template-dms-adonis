import { GetModel } from "@antelopejs/interface-database-decorators";
import type { NavCardItem } from "@antelopejs/interface-dms/base/nav-card-grid";
import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { ComposedText } from "@antelopejs/interface-dms/base/types/composed-text";
import { tableViewLink } from "@antelopejs/interface-dms/base/table-view";
import { CustomerModel, DealModel } from "../crm/database";
import { PageHelioPipeline } from "../crm/pipeline-page";
import { OPEN_DEAL_STAGES } from "../crm/deal-controller";
import { InvoiceModel } from "../finance/database";
import { SiteModel } from "../monitoring/database";
import { ProjectModel } from "../projects/database";
import { PageHelioProjects } from "../projects/list-page";
import { QuoteModel } from "../sales/database";
import { PageHelioQuotes } from "../sales/page";
import { TicketModel } from "../service/database";
import { PageHelioService } from "../service/page";
import { DAY_MS } from "../shared/seed";
import { TeamMemberModel } from "../team/database";
import { minorUnits } from "./activity";
import { HELIO_PAGES } from "./links";
import { toTime } from "./period";
import { helioNow } from "../shared/clock";

const SOON_DAYS = 14;
const CLOSING_DAYS = 30;
const SLA_WARNING_MS = DAY_MS;
const OPEN_TICKET_STATUSES = new Set(["new", "open", "waiting"]);

function money(amount: number): ComposedText {
  return {
    key: "$helio.dashboard.snapshot.money",
    params: {
      amount: { type: "money", value: minorUnits(amount), currency: "EUR" },
    },
  };
}

/** The open deals: their total amount, and the amount weighted by each deal's probability (stored 0–1). */
async function pipelineItem(): Promise<StatGroupItem> {
  const open = (await GetModel(DealModel).getAll()).filter((deal) =>
    OPEN_DEAL_STAGES.includes(deal.stage),
  );
  const total = open.reduce((sum, deal) => sum + deal.amount, 0);
  const weighted = open.reduce(
    (sum, deal) => sum + deal.amount * deal.probability,
    0,
  );
  return {
    id: "pipeline",
    icon: "i-ph-funnel",
    eyebrow: "$helio.dashboard.snapshot.pipeline",
    value: money(total),
    detail: {
      key: "$helio.dashboard.snapshot.pipelineDetail",
      params: {
        count: { type: "count", value: open.length },
        weighted: {
          type: "money",
          value: minorUnits(weighted),
          currency: "EUR",
        },
      },
    },
    to: HELIO_PAGES.pipeline,
  };
}

async function worksiteItem(): Promise<StatGroupItem> {
  const projects = await GetModel(ProjectModel).getAll();
  const now = helioNow();
  const onSite = projects.filter((project) => project.status === "in_progress");
  const starting = projects.filter((project) => {
    const start = toTime(project.plannedStart);
    return (
      (project.status === "scheduled" || project.status === "planned") &&
      start >= now &&
      start <= now + SOON_DAYS * DAY_MS
    );
  });
  return {
    id: "worksites",
    icon: "i-ph-hard-hat",
    eyebrow: "$helio.dashboard.snapshot.worksites",
    value: onSite.length,
    detail: {
      key: "$helio.dashboard.snapshot.worksitesDetail",
      params: { count: { type: "count", value: starting.length } },
    },
    to: tableViewLink(PageHelioProjects, "table", { view: "on-site" }),
  };
}

async function fleetItem(): Promise<StatGroupItem> {
  const sites = await GetModel(SiteModel).getAll();
  const offline = sites.filter((site) => site.inverterStatus === "offline");
  const degraded = sites.filter((site) => site.inverterStatus === "degraded");
  const online = sites.length - offline.length - degraded.length;
  return {
    id: "fleet",
    icon: "i-ph-solar-panel",
    tone: offline.length ? "error" : "success",
    eyebrow: "$helio.dashboard.snapshot.fleet",
    value: {
      key: "$helio.dashboard.snapshot.fleetValue",
      params: { online, total: sites.length },
    },
    detail: {
      key: "$helio.dashboard.snapshot.fleetDetail",
      params: { offline: offline.length, degraded: degraded.length },
    },
    detailTone: offline.length ? "error" : undefined,
    to: HELIO_PAGES.monitoring,
  };
}

async function serviceItem(): Promise<StatGroupItem> {
  const open = (await GetModel(TicketModel).getAll()).filter((ticket) =>
    OPEN_TICKET_STATUSES.has(ticket.status),
  );
  const urgent = open.filter((ticket) => ticket.priority === "urgent");
  const atRisk = open.filter(
    (ticket) => toTime(ticket.slaDueAt) <= helioNow() + SLA_WARNING_MS,
  );
  return {
    id: "service",
    icon: "i-ph-lifebuoy",
    tone: urgent.length ? "warning" : "muted",
    eyebrow: "$helio.dashboard.snapshot.urgent",
    value: urgent.length,
    detail: {
      key: "$helio.dashboard.snapshot.urgentDetail",
      params: { count: { type: "count", value: atRisk.length } },
    },
    detailTone: atRisk.length ? "warning" : undefined,
    to: tableViewLink(PageHelioService, "table", { view: "urgent" }),
  };
}

/**
 * The "Right now" strip: pipeline, worksites, fleet and service desk. It
 * shows what stands now, whatever the period. Each figure is read from the
 * same collection as the page it links to, and links to the saved view
 * listing the same rows, so a figure and the list behind it agree.
 */
export async function snapshot(): Promise<{ items: StatGroupItem[] }> {
  return {
    items: await Promise.all([
      pipelineItem(),
      worksiteItem(),
      fleetItem(),
      serviceItem(),
    ]),
  };
}

function countState(key: string, value: number): ComposedText {
  return { key, params: { count: { type: "count", value } } };
}

/** The sales cards. The pipeline card counts the open deals expected to close by `CLOSING_DAYS` from now, the same window as the pipeline's "Closing soon" view it opens. */
async function salesCards(): Promise<NavCardItem[]> {
  const [deals, quotes, customers] = await Promise.all([
    GetModel(DealModel).getAll(),
    GetModel(QuoteModel).getAll(),
    GetModel(CustomerModel).getAll(),
  ]);
  const horizon = helioNow() + CLOSING_DAYS * DAY_MS;
  const closing = deals.filter(
    (deal) =>
      OPEN_DEAL_STAGES.includes(deal.stage) &&
      toTime(deal.expectedClose) < horizon,
  );
  return [
    {
      id: "pipeline",
      icon: "i-ph-funnel",
      title: "$helio.dashboard.shortcuts.pipeline",
      description: "$helio.dashboard.shortcuts.pipelineDescription",
      to: tableViewLink(PageHelioPipeline, "table", { view: "closing" }),
      state: countState(
        "$helio.dashboard.shortcuts.pipelineState",
        closing.length,
      ),
    },
    {
      id: "quotes",
      icon: "i-ph-file-text",
      title: "$helio.dashboard.shortcuts.quotes",
      description: "$helio.dashboard.shortcuts.quotesDescription",
      to: tableViewLink(PageHelioQuotes, "table", { view: "awaiting" }),
      state: countState(
        "$helio.dashboard.shortcuts.quotesState",
        quotes.filter((quote) => quote.status === "sent").length,
      ),
    },
    {
      id: "customers",
      icon: "i-ph-address-book",
      title: "$helio.dashboard.shortcuts.customers",
      description: "$helio.dashboard.shortcuts.customersDescription",
      to: HELIO_PAGES.customers,
      state: countState(
        "$helio.dashboard.shortcuts.customersState",
        customers.filter((customer) => !customer.isArchived).length,
      ),
    },
  ];
}

async function operationsCards(): Promise<NavCardItem[]> {
  const [projects, tickets, team] = await Promise.all([
    GetModel(ProjectModel).getAll(),
    GetModel(TicketModel).getAll(),
    GetModel(TeamMemberModel).getAll(),
  ]);
  return [
    {
      id: "projects",
      icon: "i-ph-hard-hat",
      title: "$helio.dashboard.shortcuts.projects",
      description: "$helio.dashboard.shortcuts.projectsDescription",
      to: tableViewLink(PageHelioProjects, "table", { view: "on-site" }),
      state: countState(
        "$helio.dashboard.shortcuts.projectsState",
        projects.filter((project) => project.status === "in_progress").length,
      ),
    },
    {
      id: "service",
      icon: "i-ph-lifebuoy",
      title: "$helio.dashboard.shortcuts.service",
      description: "$helio.dashboard.shortcuts.serviceDescription",
      to: tableViewLink(PageHelioService, "table", { view: "open" }),
      state: countState(
        "$helio.dashboard.shortcuts.serviceState",
        tickets.filter((ticket) => OPEN_TICKET_STATUSES.has(ticket.status))
          .length,
      ),
    },
    {
      id: "team",
      icon: "i-ph-users-three",
      title: "$helio.dashboard.shortcuts.team",
      description: "$helio.dashboard.shortcuts.teamDescription",
      to: HELIO_PAGES.team,
      state: {
        key: "$helio.dashboard.shortcuts.teamState",
        params: {
          online: team.filter((member) => member.online).length,
          total: team.length,
        },
      },
    },
  ];
}

/** The finance cards. The invoices card sums the invoices' "Outstanding" figure: sent or overdue, archived rows stay out of it. */
async function financeCards(): Promise<NavCardItem[]> {
  const [invoices, sites] = await Promise.all([
    GetModel(InvoiceModel).getAll(),
    GetModel(SiteModel).getAll(),
  ]);
  const toCollect = invoices
    .filter(
      (invoice) =>
        !invoice.isArchived &&
        (invoice.status === "sent" || invoice.status === "overdue"),
    )
    .reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const offline = sites.filter((site) => site.inverterStatus === "offline");
  const todayKwh = sites.reduce((sum, site) => sum + site.todayKwh, 0);
  return [
    {
      id: "invoices",
      icon: "i-ph-receipt",
      title: "$helio.dashboard.shortcuts.invoices",
      description: "$helio.dashboard.shortcuts.invoicesDescription",
      to: HELIO_PAGES.invoices,
      state: {
        key: "$helio.dashboard.shortcuts.invoicesState",
        params: {
          amount: {
            type: "money",
            value: minorUnits(toCollect),
            currency: "EUR",
          },
        },
      },
    },
    {
      id: "monitoring",
      icon: "i-ph-solar-panel",
      title: "$helio.dashboard.shortcuts.monitoring",
      description: "$helio.dashboard.shortcuts.monitoringDescription",
      to: HELIO_PAGES.monitoring,
      state: {
        key: "$helio.dashboard.shortcuts.monitoringState",
        params: { kwh: { type: "number", value: Math.round(todayKwh) } },
      },
      stateTone: offline.length ? "error" : undefined,
    },
  ];
}

/**
 * One card per Helio workspace, each with the figure that matters there as
 * its live state. Like the "Right now" strip, each state is read from the
 * collection of the page its card links to.
 */
export async function shortcuts(): Promise<{ items: NavCardItem[] }> {
  const groups = await Promise.all([
    salesCards(),
    operationsCards(),
    financeCards(),
  ]);
  return { items: groups.flat() };
}
