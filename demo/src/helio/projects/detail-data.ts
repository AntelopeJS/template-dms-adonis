import { HTTPResult } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { CustomerModel } from "../crm/database";
import type { Customer } from "../crm/database";
import { InvoiceModel } from "../finance/database";
import type { Invoice } from "../finance/database";
import { QuoteModel } from "../sales/database";
import type { Quote } from "../sales/database";
import { TeamMemberModel } from "../team/database";
import type { TeamMember } from "../team/database";
import { ProjectModel, ProjectTaskModel } from "./database";
import type { Project, ProjectTask } from "./database";
import { helioNow } from "../shared/clock";

/**
 * Everything the detail page of one project shows, read in one go: the
 * project, its tasks, its customer, its quote, its invoices and the team
 * members. The routes of the page build their answers from it.
 */
export interface ProjectBundle {
  project: Project;
  tasks: ProjectTask[];
  customer?: Customer;
  quote?: Quote;
  invoices: Invoice[];
  team: Map<string, TeamMember>;
}

/** Counts of a project's tasks by state. */
export interface TaskCounts {
  todo: number;
  doing: number;
  done: number;
  total: number;
}

/**
 * The project of the page URL, or a 404 the page's Guard turns into its
 * "project not found" state.
 */
export async function loadProject(id: string): Promise<Project> {
  const project = await GetModel(ProjectModel).get(id);
  if (!project) {
    throw new HTTPResult(404, { message: "$helio.projects.detail.notFound" });
  }
  return project;
}

export async function loadTasks(projectId: string): Promise<ProjectTask[]> {
  const tasks = await GetModel(ProjectTaskModel).getBy("project", projectId);
  return tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export async function loadInvoices(projectId: string): Promise<Invoice[]> {
  const invoices = await GetModel(InvoiceModel).getBy("project", projectId);
  return invoices
    .filter((invoice) => !invoice.isArchived)
    .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
}

async function loadTeam(): Promise<Map<string, TeamMember>> {
  const members = await GetModel(TeamMemberModel).getAll();
  return new Map(members.map((member) => [member._id, member]));
}

export async function loadQuote(
  quoteId: string | undefined,
): Promise<Quote | undefined> {
  return quoteId ? GetModel(QuoteModel).get(quoteId) : undefined;
}

export async function loadBundle(id: string): Promise<ProjectBundle> {
  const project = await loadProject(id);
  const [tasks, customer, quote, invoices, team] = await Promise.all([
    loadTasks(id),
    GetModel(CustomerModel).get(project.customer),
    loadQuote(project.quote),
    loadInvoices(id),
    loadTeam(),
  ]);
  return { project, tasks, customer, quote, invoices, team };
}

export function countTasks(tasks: ProjectTask[]): TaskCounts {
  const counts: TaskCounts = { todo: 0, doing: 0, done: 0, total: 0 };
  for (const task of tasks) {
    counts[task.status] += 1;
    counts.total += 1;
  }
  return counts;
}

/** The sums of a project's invoices and the count of the overdue ones. */
export interface InvoiceTotals {
  invoiced: number;
  paid: number;
  due: number;
  overdue: number;
}

/** What the invoices of a project add up to, VAT included. */
export function invoiceTotals(invoices: Invoice[]): InvoiceTotals {
  const live = invoices.filter((invoice) => invoice.status !== "cancelled");
  const sum = (rows: Invoice[], pick: (row: Invoice) => number) =>
    Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
  return {
    invoiced: sum(live, (row) => row.total),
    paid: sum(
      live.filter((row) => row.status === "paid"),
      (row) => row.total,
    ),
    due: sum(live, (row) => row.amountDue),
    overdue: live.filter((row) => row.status === "overdue").length,
  };
}

/** The site address on one line, as a crew types it in a GPS. */
export function addressLine(project: Project): string {
  const { streetName, houseNumber, postalCode, city } = project.address ?? {};
  const street = [streetName, houseNumber].filter(Boolean).join(" ");
  const town = [postalCode, city].filter(Boolean).join(" ");
  return [street, town].filter(Boolean).join(", ");
}

/** Whether the planned end passed while the project is not finished. */
export function isLate(project: Project, now = helioNow()): boolean {
  return project.status !== "done" && project.plannedEnd.getTime() < now;
}
