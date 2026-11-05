import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import {
  Banner,
  DefaultLayout,
  Guard,
  StatGroup,
  Tab,
  TabVariant,
} from "@antelopejs/interface-dms/base";
import { helioOperationsCategory } from "../category";
import {
  activityPanel,
  detailsPanel,
  invoicesPanel,
  overviewPanel,
  quotePanel,
  tasksPanel,
} from "./detail-tabs";
import {
  PROJECT_DETAIL_API,
  PROJECT_PAGE_URL,
  PROJECTS_PAGE_URL,
  projectDetailRoute,
} from "./links";
import { PageHelioProjects } from "./list-page";
import { HELIO_PROJECT_TOPICS } from "./topics";

/** The API route of the project the page URL names, as its blocks fetch it. */
const PROJECT_ROUTE = `${PROJECT_DETAIL_API}/{{params.id}}`;

/**
 * The query key of the open tab (`?section=tasks`): the tables of the page keep
 * `?<table>.tab=` for their own tabs.
 */
const SECTION_KEY = "section";

/**
 * What a technician or a planner does from a project: drive to the site, close
 * the project, change its details.
 */
const HEADER_ACTIONS = [
  {
    id: "route",
    label: "$helio.projects.detail.actions.route",
    icon: "i-ph-navigation-arrow",
    target: {
      type: "external" as const,
      url: projectDetailRoute("directions"),
      newTab: true,
    },
    order: 0,
  },
  {
    id: "edit",
    label: "$helio.projects.detail.actions.edit",
    icon: "i-ph-pencil-simple",
    target: {
      type: "page" as const,
      url: `${PROJECT_PAGE_URL}/{{params.id}}?${SECTION_KEY}=details`,
    },
    order: 1,
  },
  {
    id: "done",
    label: "$helio.projects.detail.actions.done",
    icon: "i-ph-check-circle",
    color: "primary" as const,
    target: {
      type: "api" as const,
      url: projectDetailRoute("done"),
      method: "POST" as const,
      successMessage: "$helio.projects.detail.done.success",
    },
    confirm: { from: projectDetailRoute("done-confirm") },
    permission: PageHelioProjects.table.getAction("edit"),
    order: 2,
  },
];

/**
 * The detail page of one project. It is hidden from the menu: a project is
 * opened from the projects list, the dashboard or a link, its `_id` in the
 * URL, and the breadcrumb leads back to that list (Operations / Projects /
 * project). Every tab panel stays mounted, because the details form names the
 * project in the breadcrumb from the first visit, whatever tab is open.
 */
@RegisterPage()
export class PageHelioProject extends PageController(
  "project",
  {
    displayName: "$helio.projects.detail.page.title",
    description: "$helio.projects.detail.page.description",
    icon: "i-ph-solar-panel",
    category: helioOperationsCategory,
    parent: PageHelioProjects,
    urlSlug: "project/:id",
    hidden: true,
  },
  DefaultLayout({ fullWidth: true, headerActions: HEADER_ACTIONS }),
) {
  /**
   * An unknown or deleted project answers 404: one "not found" replaces the
   * whole page rather than every block failing on its own.
   */
  static body = Guard({
    fetchUrl: PROJECT_ROUTE,
    when: "notFound",
    fallback: {
      title: "$helio.projects.detail.notFoundTitle",
      description: "$helio.projects.detail.notFoundDescription",
      icon: "i-ph-solar-panel",
      actions: [
        {
          label: "$helio.projects.detail.backToProjects",
          to: PROJECTS_PAGE_URL,
          icon: "i-ph-arrow-left",
        },
      ],
    },
  })
    .child(
      "banner",
      Banner({
        fetchUrl: projectDetailRoute("banner"),
        realtimeTopic: HELIO_PROJECT_TOPICS,
      }),
    )
    .child(
      "stats",
      StatGroup({
        layout: "cards",
        columns: 4,
        fetchUrl: projectDetailRoute("stats"),
        realtimeTopic: HELIO_PROJECT_TOPICS,
        skeletonCount: 4,
        label: "$helio.projects.detail.stats.label",
      }),
    )
    .child(
      "tabs",
      Tab({
        items: [
          {
            label: "$helio.projects.detail.tabs.overview",
            slot: "overview",
            icon: "i-ph-info",
          },
          {
            label: "$helio.projects.detail.tabs.tasks",
            slot: "tasks",
            icon: "i-ph-list-checks",
            badge: "…",
          },
          {
            label: "$helio.projects.detail.tabs.activity",
            slot: "activity",
            icon: "i-ph-clock-counter-clockwise",
            badge: "…",
          },
          {
            label: "$helio.projects.detail.tabs.invoices",
            slot: "invoices",
            icon: "i-ph-receipt",
            badge: "…",
          },
          {
            label: "$helio.projects.detail.tabs.quote",
            slot: "quote",
            icon: "i-ph-file-text",
            badge: "…",
          },
          {
            label: "$helio.projects.detail.tabs.details",
            slot: "details",
            icon: "i-ph-pencil-simple",
          },
        ],
        variant: TabVariant.link,
        persistState: true,
        stateKey: SECTION_KEY,
        unmountOnHide: false,
        badgesUrl: projectDetailRoute("badges"),
        realtimeTopic: HELIO_PROJECT_TOPICS,
      })
        .child("overview", overviewPanel(), { slot: "overview" })
        .child("tasks", tasksPanel(), { slot: "tasks" })
        .child("activity", activityPanel(), { slot: "activity" })
        .child("invoices", invoicesPanel(), { slot: "invoices" })
        .child("quote", quotePanel(), { slot: "quote" })
        .child("details", detailsPanel(), { slot: "details" }),
    );
}
