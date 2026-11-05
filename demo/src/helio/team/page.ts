import { Get } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { Card } from "@antelopejs/interface-dms/base/card";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { Meter } from "@antelopejs/interface-dms/base/meter";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import {
  ResourceForm,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import { TopListCard } from "@antelopejs/interface-dms/base/top-list-card";
import {
  PageController,
  RegisterPage,
  pageRoutePath,
} from "@antelopejs/interface-dms/page";
import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { helioOperationsCategory } from "../category";
import { ProjectModel } from "../projects/database";
import { releaseOpenTickets } from "../service/assignees";
import { TicketModel } from "../service/database";
import { helioQuickActions } from "../shared/quick-actions";
import { TEAM_ROLES, teamController } from "./controller";
import { TeamMemberModel } from "./database";
import {
  availabilityMeter,
  onSiteMeter,
  siteLoad,
  teamStats,
  ticketCoverageMeter,
  ticketLoad,
  type WorkloadRows,
} from "./workload";
import { helioNow } from "../shared/clock";

const PAGE_SLUG = "/helio/operations/team";
const route = (path: string) => pageRoutePath(PAGE_SLUG, path);

/** The team, the tickets and the projects: a few hundred rows in all. */
async function loadRows(): Promise<WorkloadRows> {
  const [members, tickets, projects] = await Promise.all([
    GetModel(TeamMemberModel).getAll(),
    GetModel(TicketModel).getAll(),
    GetModel(ProjectModel).getAll(),
  ]);
  return { members, tickets, projects, now: new Date(helioNow()) };
}

/**
 * The team directory: who works at Helio, in which role and region, who can
 * be reached now, and how loaded each technician is with open tickets and
 * active sites. Every figure is computed from the tickets and projects.
 */
@RegisterPage()
export class PageHelioTeam extends PageController(
  "team",
  {
    displayName: "$helio.team.page.name",
    description: "$helio.team.page.description",
    icon: "i-ph-users-three",
    category: helioOperationsCategory,
    order: 2,
  },
  DefaultLayout({ fullWidth: true }),
) {
  static stats = StatGroup({
    layout: "cards",
    columns: 4,
    label: "$helio.team.stats.label",
    fetchUrl: route("/workload/stats"),
    skeletonCount: 4,
  });

  static workload = Grid({ gap: "1rem" }).child(
    "row",
    GridRow()
      .child(
        "tickets",
        TopListCard({
          title: "$helio.team.load.tickets_title",
          description: "$helio.team.load.tickets_description",
          fetchUrl: route("/workload/tickets"),
          valueFormat: "number",
          valuePrecision: 0,
          showBar: true,
          showDelta: false,
          maxHeight: "360px",
          skeletonCount: 7,
          emptyLabel: "$helio.team.load.tickets_empty",
          actions: [
            {
              label: "$helio.team.load.tickets_action",
              to: "/helio/operations/service",
              icon: "i-ph-arrow-right",
            },
          ],
        }),
      )
      .child(
        "sites",
        TopListCard({
          title: "$helio.team.load.sites_title",
          description: "$helio.team.load.sites_description",
          fetchUrl: route("/workload/sites"),
          valueFormat: "number",
          valuePrecision: 0,
          showBar: true,
          showDelta: false,
          maxHeight: "360px",
          skeletonCount: 6,
          emptyLabel: "$helio.team.load.sites_empty",
          actions: [
            {
              label: "$helio.team.load.sites_action",
              to: "/helio/operations/projects",
              icon: "i-ph-arrow-right",
            },
          ],
        }),
      )
      .child(
        "capacity",
        Card({
          title: "$helio.team.capacity.title",
          description: "$helio.team.capacity.description",
        })
          .child(
            "onSite",
            Meter({
              label: "$helio.team.capacity.on_site",
              fetchUrl: route("/workload/on-site"),
              tone: "warning",
            }),
          )
          .child(
            "availability",
            Meter({
              label: "$helio.team.capacity.availability",
              fetchUrl: route("/workload/availability"),
              format: "percent",
              tone: "success",
            }),
          )
          .child(
            "coverage",
            Meter({
              label: "$helio.team.capacity.tickets",
              fetchUrl: route("/workload/coverage"),
              legend: true,
            }),
          ),
      ),
  );

  /**
   * The member directory, as cards or a table grouped by role. Availability is
   * the "Available" view rather than a quick filter, because a quick filter on a
   * status column reads "Yes / No", not its labels. Removing a member leaves
   * their open tickets unassigned, as the removal dialog says, so the desk and
   * the counts above find them again. A click on a member (a card or a row),
   * their "Quick view" and `?record=<member id>` (a project's crew) open the
   * member read-only in a right drawer, so there is no details modal besides it;
   * "Edit" from the menu opens the form.
   */
  static table = TableView(teamController, {
    caption: "$helio.team.table.caption",
    labelKey: "name",
    searchPlaceholder: "$helio.team.table.search",
    rowClick: "single",
    pageSize: 12,
    displays: [{ id: "cards" }, { id: "table" }],
    defaultDisplay: "cards",
    grouped: { groupByField: "role", collapsible: true, count: true },
    card: { fields: ["role", "region", "online", "skills"] },
    defaultSort: { field: "name" },
    quickFilters: [{ field: "region", label: "$helio.team.columns.region" }],
    expandable: {
      fields: [
        "skills",
        { key: "bio", label: "$helio.team.table.expand_bio" },
        "phone",
        "email",
        "hiredAt",
      ],
      fieldsLabel: "$helio.team.table.expand_label",
    },
    tabs: TEAM_ROLES.map((role) => ({
      id: role.value,
      label: role.label,
      icon: role.icon,
      iconColor: role.iconColor,
      textColor: role.textColor,
      filter: { accessorKey: "role", value: role.value, mode: "is" },
    })),
    views: {
      layout: "menu",
      defaultView: "everyone",
      items: [
        {
          id: "everyone",
          label: "$helio.team.views.everyone",
          icon: "i-ph-users-three",
        },
        {
          id: "available",
          label: "$helio.team.views.available",
          icon: "i-ph-circle-wavy-check",
          dot: "success",
          count: true,
          filters: [{ accessorKey: "online", mode: "is", value: "true" }],
        },
        {
          id: "by-role",
          label: "$helio.team.views.by_role",
          icon: "i-ph-rows",
          display: "grouped",
        },
        {
          id: "newcomers",
          label: "$helio.team.views.newcomers",
          icon: "i-ph-sparkle",
          count: true,
          filters: [
            {
              accessorKey: "hiredAt",
              mode: "greater_than",
              value: "{{now-365d}}",
            },
          ],
          sort: [{ field: "hiredAt", desc: true }],
        },
        {
          id: "directory",
          label: "$helio.team.views.directory",
          icon: "i-ph-address-book",
          display: "table",
          density: "compact",
          columns: { visible: ["email", "phone"], hidden: ["hiredAt"] },
        },
      ],
    },
    footer: {
      countLabel: "$helio.team.table.count",
      summary: [
        {
          label: "$helio.team.table.summary_available",
          op: "count",
          where: { field: "online", equals: true },
        },
        {
          label: "$helio.team.table.summary_technicians",
          op: "count",
          where: { field: "role", equals: "technician" },
        },
      ],
      legend: "role",
    },
    emptyStates: {
      firstRun: {
        title: "$helio.team.empty.first_title",
        description: "$helio.team.empty.first_description",
        icon: "i-ph-users-three",
      },
      filtered: {
        title: "$helio.team.empty.filtered_title",
        description: "$helio.team.empty.filtered_description",
      },
    },
    guards: {
      delete:
        (_ctx, { ids }) =>
        () =>
          releaseOpenTickets(ids),
    },
    formContainer: {
      type: "modal",
      size: "2xl",
      pages: {
        new: {
          displayName: "$helio.team.form.new_title",
          description: "$helio.team.form.new_description",
        },
        edit: {
          displayName: "$helio.team.form.edit_title",
          description: "$helio.team.form.edit_description",
        },
        details: { displayName: "$helio.team.form.details_title" },
      },
    },
    rowActions: {
      add: true,
      edit: true,
      details: false,
      copyLink: true,
      hasSelection: true,
      delete: {
        isEnabled: true,
        confirm: {
          title: "$helio.team.delete.title",
          description: "$helio.team.delete.description",
          icon: "i-ph-user-minus",
          color: "error",
          confirmLabel: "$helio.team.delete.confirm",
        },
      },
      custom: [
        {
          id: "quick-view",
          label: "$helio.team.quickView.action",
          icon: "i-ph-sidebar-simple",
          isDefault: true,
          target: {
            type: "drawer",
            direction: "right",
            title: "$helio.team.quickView.title",
            description: "$helio.team.quickView.description",
            rowTitle: "{name}",
            positionLabel: "$helio.team.quickView.position",
            deepLink: true,
            notFound: {
              title: "$helio.team.quickView.notFoundTitle",
              description: "$helio.team.quickView.notFoundDescription",
            },
            component: ResourceForm(teamController, {
              mode: "view",
              rowId: "{{row._id}}",
            }),
          },
        },
      ],
    },
  });

  /**
   * Figures of the blocks above, read again on every visit by this and the other
   * `/workload/*` routes: they follow the tickets and projects as the other
   * pages change them.
   */
  @Get("/workload/stats")
  async workloadStats() {
    return { items: teamStats(await loadRows()) };
  }

  @Get("/workload/tickets")
  async workloadTickets() {
    return { items: ticketLoad(await loadRows()) };
  }

  @Get("/workload/sites")
  async workloadSites() {
    return { items: siteLoad(await loadRows()) };
  }

  @Get("/workload/on-site")
  async workloadOnSite() {
    return onSiteMeter(await loadRows());
  }

  @Get("/workload/availability")
  async workloadAvailability() {
    return availabilityMeter(await loadRows());
  }

  @Get("/workload/coverage")
  async workloadCoverage() {
    return ticketCoverageMeter(await loadRows());
  }
}

QuickAction("helio-team-add", {
  category: helioQuickActions,
  displayName: "$helio.team.quick.add",
  icon: "i-ph-user-plus",
  target: {
    type: "openForm",
    page: PageHelioTeam,
    component: PageHelioTeam.table,
  },
});
