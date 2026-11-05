import {
  BasicDataModel,
  Field,
  Fixture,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../schema";
import { buildInvoices } from "./fixtures";

const TABLE_NAME = "helio_invoices";

export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid" | "cancelled";
export type PaymentMethod = "transfer" | "direct_debit" | "card";

@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
@Fixture(() => buildInvoices())
export class Invoice extends Table {
  @Field("string") declare _id: string;

  @Index() @Field("string") declare number: string;
  @Index() @Field("string") declare customer: string;
  @Index() @Field("string") declare project?: string;
  @Index() @Field("string") declare quote?: string;
  @Index() @Field("string") declare status: InvoiceStatus;
  @Index() @Field("date") declare issuedAt: Date;
  @Index() @Field("date") declare dueAt: Date;
  @Field("date") declare paidAt?: Date;
  /** Amounts in euros: excluding VAT, the VAT, and both. */
  @Field("number") declare amountExcl: number;
  /** 0.06 (home renovation) or 0.21, stored 0–1. */
  @Field("number") declare vatRate: number;
  @Field("number") declare vatAmount: number;
  @Field("number") declare total: number;
  /** What is still to be paid: 0 once paid or cancelled. */
  @Field("number") declare amountDue: number;
  @Field("string") declare paymentMethod: PaymentMethod;
  /** Last payment reminder sent for an overdue invoice, and how many so far. */
  @Field("date") declare remindedAt?: Date;
  @Field("number") declare reminderCount?: number;
  @Index() @Field("boolean") declare isArchived: boolean;
}

export class InvoiceModel extends BasicDataModel(Invoice, TABLE_NAME) {}
