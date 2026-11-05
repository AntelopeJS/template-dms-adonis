import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Relation,
  Table,
} from "@antelopejs/interface-database-decorators";
import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildProjects, buildProjectTasks } from "./fixtures";

const PROJECTS_TABLE = "helio_projects";
const TASKS_TABLE = "helio_project_tasks";

export type ProjectType =
  | "residential_pv"
  | "commercial_pv"
  | "battery"
  | "ev_charger";

export type ProjectStatus =
  | "planned"
  | "scheduled"
  | "in_progress"
  | "inspection"
  | "done"
  | "on_hold";

export type ProjectTaskStatus = "todo" | "doing" | "done";

@RegisterTable(PROJECTS_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() => buildProjects())
export class Project extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare code: string;
  @Field("string") declare name: string;
  @Index() @Field("string") declare customer: string;
  @Index() @Field("string") declare quote?: string;
  @Index() @Field("string") declare type: ProjectType;
  @Index() @Field("string") declare status: ProjectStatus;
  @Index() @Field("date") declare plannedStart: Date;
  @Field("date") declare plannedEnd: Date;
  @Index() @Field("string") declare leadTechnician?: string;
  /** `_id`s of helio_team rows working on the site with the lead. */
  @Field("any") declare crew: string[];
  @Field("object") declare address: DefaultDataTypes.Address;
  /** Peak power in kWp; absent for a battery or a charger (no panels). */
  @Field("number") declare capacityKwp?: number;
  /** Amount excluding VAT, in euros. */
  @Field("number") declare budget: number;
  @Field("string") declare notes?: string;
}

export class ProjectModel extends BasicDataModel(Project, PROJECTS_TABLE) {}

@RegisterTable(TASKS_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() => buildProjectTasks())
export class ProjectTask extends Table {
  @Field("string") declare _id: string;

  @Index()
  @Field("string")
  @Relation({ to: () => Project })
  declare project: string;
  @Field("string") declare title: string;
  @Index() @Field("string") declare status: ProjectTaskStatus;
  @Index() @Field("string") declare assignee?: string;
  @Field("date") declare dueDate?: Date;
  @Field("number") declare estimateHours?: number;
  /** Manual order within a project, spaced by 1000 so a move fits between two rows. */
  @Index() @Field("number") declare position: number;
}

export class ProjectTaskModel extends BasicDataModel(
  ProjectTask,
  TASKS_TABLE,
) {}
