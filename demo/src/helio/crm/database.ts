import {
  attachModifier,
  AutoDateModifier,
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Relation,
  Table,
} from "@antelopejs/interface-database-decorators";
import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { TeamMember } from "../team/database";
import { buildCustomers, buildDeals } from "./fixtures";
import { withFirstContact } from "./first-contact";
import { helioNow } from "../shared/clock";

const CUSTOMERS_TABLE = "helio_customers";
const DEALS_TABLE = "helio_deals";

export type CustomerKind = "residential" | "business";
export type LeadSource = "website" | "referral" | "fair" | "partner" | "phone";
export type DealStage =
  | "lead"
  | "qualified"
  | "site_visit"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

/** Households and companies Helio sells to. */
@RegisterTable(CUSTOMERS_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() => withFirstContact(buildCustomers()))
export class Customer extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare kind: CustomerKind;
  @Field("string") declare name: string;
  /** Belgian VAT number, businesses only (null once cleared). */
  @Field("string") declare vatNumber?: string | null;
  @Field("string") declare contactName: string;
  @Field("string") declare email: string;
  @Field("string") declare phone: string;
  @Field("any") declare address: DefaultDataTypes.Address;
  @Field(["string"]) declare segments: string[];
  @Index() @Field("string") declare source: LeadSource;
  @Index() @Field("boolean") declare isVip: boolean;
  @Index()
  @Field("string")
  @Relation({ to: () => TeamMember })
  declare owner?: string;
  @Field("string") declare website?: string | null;
  /** Rich text (HTML). */
  @Field("string") declare notes?: string;
  @Index() @Field("date") declare createdAt: Date;
  @Index() @Field("boolean") declare isArchived?: boolean;
}

/**
 * Stamps the creation date of rows created from the dashboard, but keeps the
 * date a fixture provides (`CreationTime` would overwrite it, since fixtures go
 * through the same insert event).
 */
class CreationTimeIfMissing extends AutoDateModifier {
  override insert(
    object: Parameters<AutoDateModifier["insert"]>[0],
    field: string,
  ): void {
    object[field] ??= new Date(helioNow());
  }
}

attachModifier(Customer, CreationTimeIfMissing, "createdAt", {
  type: "created",
});

export class CustomerModel extends BasicDataModel(Customer, CUSTOMERS_TABLE) {}

/** Sales opportunities, from the first contact to won or lost. */
@RegisterTable(DEALS_TABLE, DEMO_SCHEMA_NAME)
@Fixture(() => buildDeals())
export class Deal extends Table {
  @Field("string") declare _id: string;

  @Field("string") declare title: string;
  @Index()
  @Field("string")
  @Relation({ to: () => Customer })
  declare customer: string;
  /** The customer's name, kept in step for the search (deal-derived.ts). */
  @Field("string") declare customerName: string;
  @Index()
  @Field("string")
  @Relation({ to: () => TeamMember })
  declare owner: string;
  @Index() @Field("string") declare stage: DealStage;
  /** Neither won nor lost, kept in step on every write (deal-derived.ts). */
  @Index() @Field("boolean") declare isOpen: boolean;
  /** Expected amount excluding VAT, in euros. */
  @Field("number") declare amount: number;
  /** Win probability, 0–1. */
  @Field("number") declare probability: number;
  /** amount × probability, kept in step on every write (deal-derived.ts). */
  @Field("number") declare weightedAmount: number;
  @Index() @Field("string") declare source: LeadSource;
  @Index() @Field("date") declare expectedClose: Date;
  @Index() @Field("date") declare lastActivityAt: Date;
  @Field("string") declare nextStep?: string;
  /**
   * The signed quote whose kick-off call is the deal's next step, worded in
   * the reader's language (deal-controller.ts); null once a next step is
   * typed again.
   */
  @Field("string") declare kickoffQuote?: string | null;
  @Field("string") declare lostReason?: string | null;
}

export class DealModel extends BasicDataModel(Deal, DEALS_TABLE) {}
