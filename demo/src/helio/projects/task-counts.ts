import { GetModel } from "@antelopejs/interface-database-decorators";
import { ProjectTaskModel } from "./database";

/** The task counts of a project. */
export interface ProjectTaskTally {
  done: number;
  total: number;
}

/**
 * One read per listed row, shared by the getters that need it: the row object
 * a list hands to the getters is the key.
 */
const tallies = new WeakMap<object, Promise<ProjectTaskTally>>();

/** How many tasks a project has, and how many are done. */
export function projectTaskCounts(row: {
  _id: string;
}): Promise<ProjectTaskTally> {
  let tally = tallies.get(row);
  if (!tally) {
    tally = Promise.resolve(
      GetModel(ProjectTaskModel).getBy("project", row._id),
    ).then((tasks) => ({
      done: tasks.filter((task) => task.status === "done").length,
      total: tasks.length,
    }));
    tallies.set(row, tally);
  }
  return tally;
}
