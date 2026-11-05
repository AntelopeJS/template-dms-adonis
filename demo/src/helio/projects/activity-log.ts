import { GetModel } from "@antelopejs/interface-database-decorators";
import { logActivity } from "../dashboard/log";
import { ProjectModel } from "./database";

/** The statuses that reach the dashboard's activity feed, with their type. */
const LOGGED: ReadonlyMap<string, "project_started" | "project_done"> = new Map(
  [
    ["in_progress", "project_started"],
    ["done", "project_done"],
  ],
);

/**
 * Logs a project that just moved to `status` on the dashboard's activity feed,
 * in the name of its lead technician and as "CH-0123 · name". The project is
 * read back once written, and nothing is logged unless it holds `status`.
 */
export async function logProjectStatus(
  id: string,
  status: string,
): Promise<void> {
  const type = LOGGED.get(status);
  const project = await GetModel(ProjectModel).get(id);
  if (!type || !project || project.status !== status) return;
  await logActivity({
    type,
    actor: project.leadTechnician ?? "",
    subject: `${project.code} · ${project.name}`,
    record: { kind: "project", id },
  });
}

/**
 * A guard result for the projects table's edit: a project moved on site or
 * to done (from its form or across the board) is logged once written.
 */
export function afterProjectEdit(
  id: string,
  status: string | undefined,
  previous: string | undefined,
): (() => Promise<void>) | undefined {
  if (!status || status === previous || !LOGGED.has(status)) return undefined;
  return () => logProjectStatus(id, status);
}
