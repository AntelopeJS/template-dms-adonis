import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { helioQuickActions } from "../shared/quick-actions";
import { PageHelioProjects } from "./list-page";

QuickAction("helio-new-project", {
  category: helioQuickActions,
  displayName: "$helio.projects.quickActions.newProject",
  icon: "i-ph-solar-panel",
  target: {
    type: "openForm",
    page: PageHelioProjects,
    component: PageHelioProjects.table,
  },
});

QuickAction("helio-projects-planning", {
  category: helioQuickActions,
  displayName: "$helio.projects.quickActions.planning",
  icon: "i-ph-calendar-dots",
  target: {
    type: "navigate",
    page: PageHelioProjects,
    query: { "table.view": "planning" },
  },
});
