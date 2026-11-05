import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildQuotes } from "./fixtures";

const TABLE_NAME = "helio_quotes";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

/** One line of a quote: a catalog product, its wording, quantity and price. */
export interface QuoteLine {
  /** `_id` of a helio_products row (PRODUCT_ROSTER). */
  product: string;
  label: string;
  qty: number;
  /** Unit price excluding VAT, in euros. */
  unitPrice: number;
}

@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildQuotes())
export class Quote extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare number: string;
  @Index() @Field("string") declare customer: string;
  /** The customer's name, kept in step for the search (customer-names.ts). */
  @Field("string") declare customerName: string;
  @Index() @Field("string") declare deal?: string;
  @Index() @Field("string") declare status: QuoteStatus;
  /**
   * Stored inside the row, so a quote reads and saves in one piece. `subtotal`
   * and `total` are derived from the lines and the VAT rate on every write.
   */
  @Field("any") declare lines: QuoteLine[];
  @Field("number") declare subtotal: number;
  /** 0.06 (residential renovation) or 0.21 (business), stored 0–1. */
  @Field("number") declare vatRate: number;
  @Field("number") declare total: number;
  @Index() @Field("date") declare issuedAt: Date;
  @Field("date") declare validUntil: Date;
  @Field("date") declare sentAt?: Date;
  @Field("date") declare signedAt?: Date;
  @Index() @Field("string") declare portalToken: string;
  @Field("string") declare notes?: string;
  /** Why the customer turned it down, as typed when marking it rejected. */
  @Field("string") declare rejectionReason?: string;
}

export class QuoteModel extends BasicDataModel(Quote, TABLE_NAME) {}
