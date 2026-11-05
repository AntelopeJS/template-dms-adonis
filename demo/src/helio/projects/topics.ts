import { tableViewRowTopic } from "@antelopejs/interface-dms/base/table-view";

/** Where the project and task data controllers are served. */
export const PROJECTS_LOCATION = "/api/helio/projects";
export const TASKS_LOCATION = "/api/helio/project-tasks";

/**
 * The realtime topics the projects and tasks tables publish their row changes
 * on. The detail page's figures listen to them, so a task moved on the board
 * or a project edited anywhere refreshes the progress, counters and history.
 */
export const HELIO_PROJECT_TOPICS = [
  tableViewRowTopic(PROJECTS_LOCATION),
  tableViewRowTopic(TASKS_LOCATION),
];
