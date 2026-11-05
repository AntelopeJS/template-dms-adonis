import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildTickets } from "./fixtures";

const TABLE_NAME = "helio_tickets";

export type TicketCategory =
  | "no_production"
  | "inverter_error"
  | "monitoring"
  | "damage"
  | "billing"
  | "other";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "new" | "open" | "waiting" | "resolved" | "closed";
export type TicketChannel = "phone" | "email" | "portal" | "monitoring_alert";

@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildTickets())
export class Ticket extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare number: string;
  @Field("string") declare subject: string;
  @Index() @Field("string") declare customer: string;
  @Index() @Field("string") declare site?: string;
  @Index() @Field("string") declare category: TicketCategory;
  @Index() @Field("string") declare priority: TicketPriority;
  @Index() @Field("string") declare status: TicketStatus;
  @Field("string") declare channel: TicketChannel;
  @Index() @Field("string") declare assignee?: string;
  @Index() @Field("date") declare slaDueAt: Date;
  @Index() @Field("date") declare createdAt: Date;
  @Field("date") declare resolvedAt?: Date;
  @Field("string") declare description?: string;
  @Index() @Field("boolean") declare pinned: boolean;
}

export class TicketModel extends BasicDataModel(Ticket, TABLE_NAME) {}
