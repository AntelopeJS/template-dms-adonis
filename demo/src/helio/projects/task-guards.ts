import { HTTPResult, type RequestContext } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { isNumber, isText } from "../shared/json";
import { type ProjectTask, ProjectTaskModel } from "./database";

/** Positions are spaced by this step so a move lands between two rows. */
const POSITION_STEP = 1000;

/**
 * The "new" guard of a project's tasks table. A task always belongs to a
 * project: the table fills it from the page URL, so a request without one
 * did not come from a project page. Once written, a task the form left
 * without a position goes to the end of the project's list rather than the
 * top.
 */
export function newProjectTaskGuard(
  _ctx: RequestContext,
  { body }: { body: Partial<Pick<ProjectTask, "project">> },
): () => Promise<void> {
  const project = body.project;
  if (!isText(project) || project === "") {
    throw new HTTPResult(400, {
      message: "$helio.projects.detail.tasks.projectRequired",
      field: "project",
    });
  }
  return () => placeUnorderedTasksLast(project);
}

async function placeUnorderedTasksLast(project: string): Promise<void> {
  const model = GetModel(ProjectTaskModel);
  const tasks = await model.getBy("project", project);
  const unordered = tasks.filter((task) => !isNumber(task.position));
  let last = Math.max(
    0,
    ...tasks.map((task) => (isNumber(task.position) ? task.position : 0)),
  );
  for (const task of unordered) {
    last += POSITION_STEP;
    await model.update(task._id, { position: last });
  }
}
