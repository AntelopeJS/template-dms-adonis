import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import type { Tone } from "@antelopejs/interface-dms/base/types";
import { DEMO_SCHEMA_NAME } from "../../schema";
import type { ActivityType } from "./activity-links";
import { buildActivity } from "./fixtures";

export type { ActivityType } from "./activity-links";

const TABLE_NAME = "helio_activity";

/** The business events the dashboard's activity feed lists, newest first. */
@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildActivity())
export class Activity extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("date") declare at: Date;
  /** `_id` of the helio_team member who acted. */
  @Index() @Field("string") declare actor: string;
  @Index() @Field("string") declare type: ActivityType;
  /** What the event is about, as written: a quote number, a customer name… */
  @Field("string") declare subject: string;
  /** Dashboard path of the record (`/helio/…`). */
  @Field("string") declare link: string;
  @Field("string") declare tone: Tone;
}

export class ActivityModel extends BasicDataModel(Activity, TABLE_NAME) {}
