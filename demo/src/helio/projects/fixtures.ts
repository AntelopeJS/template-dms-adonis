import { teamIdsByRole } from "../shared/roster";
import { createRng, DAY_MS, padId, type Rng } from "../shared/seed";
import type {
  Project,
  ProjectStatus,
  ProjectTask,
  ProjectTaskStatus,
  ProjectType,
} from "./database";
import { linesSubtotal } from "../sales/lines";
import { previousWorkday } from "./calendar";
import { type ProjectPlan, projectPlans } from "./plan";

/**
 * A row of the helio_projects seed, built from the project plan (plan.ts):
 * the project carries the customer, quote, budget and capacity of its plan.
 */
export type ProjectSeed = Pick<
  Project,
  | "_id"
  | "code"
  | "name"
  | "customer"
  | "quote"
  | "type"
  | "status"
  | "plannedStart"
  | "plannedEnd"
  | "leadTechnician"
  | "crew"
  | "address"
  | "capacityKwp"
  | "budget"
  | "notes"
>;

/** A row of the helio_project_tasks seed. */
export type ProjectTaskSeed = Pick<
  ProjectTask,
  | "_id"
  | "project"
  | "title"
  | "status"
  | "assignee"
  | "dueDate"
  | "estimateHours"
  | "position"
>;

/** The team members who take the office steps of a project. */
const OFFICE = teamIdsByRole("office");
/** The gap between the positions of consecutive tasks of a project. */
const POSITION_STEP = 1000;

/** The French name of each type of project, which starts its name. */
const TYPE_NAMES: Record<ProjectType, string> = {
  residential_pv: "Installation photovoltaïque",
  commercial_pv: "Centrale photovoltaïque",
  battery: "Batterie domestique",
  ev_charger: "Borne de recharge",
};

/** The notes a project in each status may carry, one picked at random. */
const NOTES: Partial<Record<ProjectStatus, string[]>> = {
  on_hold: [
    "En attente de l'accord de raccordement du gestionnaire de réseau.",
    "Le client a demandé de reporter le chantier après la rénovation de la toiture.",
    "Permis d'urbanisme en cours d'instruction à la commune.",
  ],
  inspection: [
    "Contrôle RGIE planifié, schéma unifilaire transmis à l'organisme agréé.",
  ],
  in_progress: ["Échafaudage livré la veille, accès par le jardin."],
};

/** The project name: its type, its capacity if it has one, its customer. */
function nameOf(plan: ProjectPlan): string {
  const size =
    plan.capacityKwp > 0
      ? ` ${plan.capacityKwp.toLocaleString("fr-BE")} kWc`
      : "";
  return `${TYPE_NAMES[plan.type]}${size} — ${plan.customer.name}`;
}

/**
 * The seed row of a planned project. A battery or a charger has no peak
 * power: its capacity is absent, shown "—", not "0 kWp".
 */
function toProject(rng: Rng, plan: ProjectPlan): ProjectSeed {
  const notes = NOTES[plan.status];
  return {
    _id: plan.projectId,
    code: `CH-${String(100 + plan.index).padStart(4, "0")}`,
    name: nameOf(plan),
    customer: plan.customer._id,
    quote: plan.quoteId,
    type: plan.type,
    status: plan.status,
    plannedStart: plan.start,
    plannedEnd: plan.end,
    leadTechnician: plan.leadTechnician,
    crew: plan.crew,
    address: plan.customer.address,
    capacityKwp: plan.capacityKwp > 0 ? plan.capacityKwp : undefined,
    budget: linesSubtotal(plan.lines),
    notes: notes && rng.chance(0.8) ? rng.pick(notes) : undefined,
  };
}

/** The projects seed, built on first use. */
let projects: ProjectSeed[] | undefined;

/** The 80 projects, `proj-001` … `proj-080`. */
export function buildProjects(): ProjectSeed[] {
  if (!projects) {
    const rng = createRng(0x9e110003);
    projects = projectPlans().map((plan) => toProject(rng, plan));
  }
  return projects;
}

/**
 * A step of a project: who does it (office or site crew), how long it takes,
 * and when it is due relative to the start (days).
 */
interface TaskTemplate {
  title: string;
  office?: boolean;
  hours: number;
  /** Days from the start; `end` for days from the planned end. */
  due: number | { end: number };
}

/** The steps that open a project: the site survey and the order. */
const COMMON_BEFORE: TaskTemplate[] = [
  { title: "Visite technique et relevé de toiture", hours: 2, due: -21 },
  { title: "Commande du matériel", office: true, hours: 1, due: -14 },
];

/** The steps of each type of project, in order. */
const TASKS: Record<ProjectType, TaskTemplate[]> = {
  residential_pv: [
    ...COMMON_BEFORE,
    {
      title: "Demande de raccordement au gestionnaire de réseau",
      office: true,
      hours: 1,
      due: -10,
    },
    { title: "Pose des rails et des panneaux", hours: 12, due: 0 },
    {
      title: "Câblage et mise en service de l'onduleur",
      hours: 4,
      due: { end: 0 },
    },
    { title: "Contrôle RGIE", office: true, hours: 2, due: { end: 7 } },
  ],
  commercial_pv: [
    ...COMMON_BEFORE,
    {
      title: "Étude de stabilité de la toiture",
      office: true,
      hours: 6,
      due: -18,
    },
    {
      title: "Demande de raccordement au gestionnaire de réseau",
      office: true,
      hours: 2,
      due: -12,
    },
    {
      title: "Échafaudage, structures et pose des panneaux",
      hours: 48,
      due: 0,
    },
    {
      title: "Raccordement des onduleurs triphasés",
      hours: 12,
      due: { end: -1 },
    },
    {
      title: "Contrôle RGIE et réception",
      office: true,
      hours: 3,
      due: { end: 7 },
    },
  ],
  battery: [
    ...COMMON_BEFORE,
    {
      title: "Installation de la batterie et de l'onduleur hybride",
      hours: 5,
      due: 0,
    },
    { title: "Paramétrage et mise à jour du firmware", hours: 1, due: 0 },
    { title: "Contrôle RGIE", office: true, hours: 1, due: { end: 7 } },
  ],
  ev_charger: [
    { title: "Visite technique du tableau électrique", hours: 1, due: -14 },
    { title: "Pose de la borne et tirage du câble", hours: 4, due: 0 },
    {
      title: "Configuration de la borne et du badge",
      hours: 1,
      due: { end: 0 },
    },
    { title: "Contrôle RGIE", office: true, hours: 1, due: { end: 7 } },
  ],
};

/** Whether a step is due relative to the planned end. */
function isEndOffset(due: TaskTemplate["due"]): due is { end: number } {
  return typeof due !== "number";
}

/** The due date of a step, moved back to a working day if it is a weekend. */
function dueDate(plan: ProjectPlan, template: TaskTemplate): Date {
  const { due } = template;
  const from = isEndOffset(due) ? plan.end : plan.start;
  const days = isEndOffset(due) ? due.end : due;
  return previousWorkday(new Date(from.getTime() + days * DAY_MS));
}

/** How far a project has gone: the share of its tasks already done. */
function doneShare(rng: Rng, status: ProjectStatus): number {
  switch (status) {
    case "done":
      return 1;
    case "inspection":
      return 0.8;
    case "in_progress":
      return 0.35 + rng.next() * 0.3;
    case "scheduled":
      return 0.3;
    case "on_hold":
      return 0.25;
    case "planned":
      return rng.chance(0.5) ? 0.15 : 0;
  }
}

/**
 * The status of the task at `index`: done before `doneCount`, then, for a
 * project on site or in inspection, one under way.
 */
function taskStatus(
  index: number,
  doneCount: number,
  status: ProjectStatus,
): ProjectTaskStatus {
  if (index < doneCount) return "done";
  if (
    index === doneCount &&
    (status === "in_progress" || status === "inspection")
  )
    return "doing";
  return "todo";
}

/**
 * The tasks of a plan, numbered from `startId`; their progress follows the
 * project's.
 */
function tasksOf(
  rng: Rng,
  plan: ProjectPlan,
  startId: number,
): ProjectTaskSeed[] {
  const templates = TASKS[plan.type];
  const doneCount = Math.floor(templates.length * doneShare(rng, plan.status));
  const site = [plan.leadTechnician, ...plan.crew];
  return templates.map((template, index) => ({
    _id: padId("task", startId + index, 4),
    project: plan.projectId,
    title: template.title,
    status: taskStatus(index, doneCount, plan.status),
    assignee: template.office
      ? rng.pick(OFFICE)
      : index % 2 === 0
        ? plan.leadTechnician
        : rng.pick(site),
    dueDate: dueDate(plan, template),
    estimateHours: template.hours,
    position: (index + 1) * POSITION_STEP,
  }));
}

/** The tasks seed, built on first use. */
let tasks: ProjectTaskSeed[] | undefined;

/** Between 4 and 7 tasks per project, `task-0001` …, ordered by `position`. */
export function buildProjectTasks(): ProjectTaskSeed[] {
  if (!tasks) {
    const rng = createRng(0x9e110004);
    const all: ProjectTaskSeed[] = [];
    for (const plan of projectPlans())
      all.push(...tasksOf(rng, plan, all.length + 1));
    tasks = all;
  }
  return tasks;
}
