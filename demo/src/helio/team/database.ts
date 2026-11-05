import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import type { TeamRole } from "../shared/roster";
import { buildTeamMembers } from "./fixtures";

const TABLE_NAME = "helio_team";

/** The staff of the installer: sales reps, technicians, office and the manager. */
@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildTeamMembers())
export class TeamMember extends Table {
  @Field("string") declare _id: string;

  @Field("string") declare name: string;
  @Field("string") declare email: string;
  @Field("string") declare phone: string;
  @Index() @Field("string") declare role: TeamRole;
  /** A remote avatar URL (pravatar), drawn by IdentityDisplay and relation pickers. */
  @Field("string") declare avatar?: string;
  @Field(["string"]) declare skills: string[];
  @Index() @Field("boolean") declare online: boolean;
  /** Hex colour identifying the member on plannings and charts. */
  @Field("string") declare color: string;
  @Index() @Field("string") declare region: string;
  @Field("date") declare hiredAt: Date;
  @Field("string") declare bio?: string;
}

export class TeamMemberModel extends BasicDataModel(TeamMember, TABLE_NAME) {}
