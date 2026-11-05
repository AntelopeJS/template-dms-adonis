import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildSites } from "./fixtures";

const TABLE_NAME = "helio_sites";

export type InverterStatus = "online" | "degraded" | "offline";

@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildSites())
export class Site extends Table {
  @Field("string") declare _id: string;

  @Field("string") declare name: string;
  @Index() @Field("string") declare customer: string;
  /** The finished helio_projects row that built the installation. */
  @Index() @Field("string") declare project: string;
  @Index() @Field("string") declare city: string;
  @Field("number") declare capacityKwp: number;
  @Index() @Field("string") declare inverterStatus: InverterStatus;
  @Field("date") declare commissionedAt: Date;
  @Field("number") declare todayKwh: number;
  /** Daily production of the last seven days, oldest first, in kWh. */
  @Field("any") declare last7Days: number[];
  @Index() @Field("date") declare lastSeenAt: Date;
}

export class SiteModel extends BasicDataModel(Site, TABLE_NAME) {}
