import { Controller, type ControllerClass } from "@antelopejs/interface-api";
import {
  DataController,
  RegisterDataController,
} from "@antelopejs/interface-data-api";
import {
  Access,
  AccessMode,
  Listable,
  Mandatory,
  ModelReference,
  Optional,
  Sortable,
} from "@antelopejs/interface-data-api/metadata";
import { Model } from "@antelopejs/interface-database-decorators";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Searchable } from "@antelopejs/interface-dms/base/searchable";
import {
  ArchiveField,
  type CellSubline,
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { customerController } from "../crm/controller";
import { projectController } from "../projects/controller";
import { quoteController } from "../sales/controller";
import { VAT_RESIDENTIAL } from "../sales/lines";
import { cents, DAY_MS } from "../shared/seed";
import { Invoice, InvoiceModel, type InvoiceStatus } from "./database";
import { daysLate } from "./due";
import { withInvoiceDefaults } from "./numbering";
import { helioNow } from "../shared/clock";

/** An invoice's life. Exported for the status tabs, nav badge and row rules. */
export const INVOICE_STATUSES = [
  {
    value: "draft",
    label: "$helio.finance.statuses.draft",
    icon: "i-ph-file-dashed",
    iconColor: "neutral",
    textColor: "neutral",
  },
  {
    value: "sent",
    label: "$helio.finance.statuses.sent",
    icon: "i-ph-paper-plane-tilt",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "overdue",
    label: "$helio.finance.statuses.overdue",
    icon: "i-ph-warning-circle",
    iconColor: "error",
    textColor: "error",
  },
  {
    value: "paid",
    label: "$helio.finance.statuses.paid",
    icon: "i-ph-check-circle",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "cancelled",
    label: "$helio.finance.statuses.cancelled",
    icon: "i-ph-prohibit",
    iconColor: "neutral",
    textColor: "neutral",
  },
] as const;

export const PAYMENT_METHODS = [
  {
    value: "transfer",
    label: "$helio.finance.paymentMethods.transfer",
    icon: "i-ph-bank",
  },
  {
    value: "direct_debit",
    label: "$helio.finance.paymentMethods.directDebit",
    icon: "i-ph-arrows-clockwise",
  },
  {
    value: "card",
    label: "$helio.finance.paymentMethods.card",
    icon: "i-ph-credit-card",
  },
] as const;

/** Statuses for which nothing is left to pay. */
const SETTLED: readonly string[] = ["paid", "cancelled"];

const day = (date: Date) =>
  ({ type: "date", value: date.toISOString(), format: "day" }) as const;

/**
 * The Data API controller of the invoices. Not exported on purpose: emitting a
 * .d.ts for this class would require naming types from the nested
 * `@antelopejs/interface-core` copies (TS2742), hence the `ControllerClass`
 * alias below.
 */
@RegisterDataController()
class invoiceDataAPI extends DataController(
  Invoice,
  { ...TableViewRoutes.All, new: withInvoiceDefaults(TableViewRoutes.New) },
  Controller("/api/helio/invoices"),
) {
  @ModelReference()
  @Model(InvoiceModel)
  declare model: InvoiceModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  /** Left empty on a new invoice, it takes the next number (see numbering.ts). */
  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.number",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.finance.invoices.placeholders.number",
      maxLength: 20,
    }),
    filterable: true,
    display: new DefaultDisplays.MonoDisplay({ copy: true }),
    size: 140,
  })
  @Mandatory("edit")
  @Access(AccessMode.ReadWrite)
  declare number: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.finance.invoices.placeholders.customer",
    }),
    filterable: true,
    size: 200,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  @Listable()
  @Column({
    name: "$helio.finance.invoices.columns.project",
    type: new DefaultDataTypes.RelationType({
      dataApiController: projectController,
      keyMapping: { label: "code", value: "_id" },
      placeholder: "$helio.finance.invoices.placeholders.project",
      deselectable: true,
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare project: string;

  @Listable()
  @Column({
    name: "$helio.finance.invoices.columns.quote",
    type: new DefaultDataTypes.RelationType({
      dataApiController: quoteController,
      keyMapping: { label: "number", value: "_id" },
      placeholder: "$helio.finance.invoices.placeholders.quote",
      deselectable: true,
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare quote: string;

  /**
   * Marking an invoice paid (or cancelling it) clears what is due, and paid
   * also stamps the payment date; any other status leaves the total to pay.
   */
  @Listable(["status"])
  @Sortable()
  @Exported(["status"])
  @Column({
    name: "$helio.finance.invoices.columns.status",
    type: new DefaultDataTypes.SelectType({ items: [...INVOICE_STATUSES] }),
    filterable: true,
    defaultValue: "draft",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        draft: "neutral",
        sent: "info",
        overdue: "error",
        paid: "success",
        cancelled: "neutral",
      },
      subField: "statusDetail",
      subTone: "muted",
    }),
    size: 170,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  get status(): InvoiceStatus {
    return this.table.status;
  }
  set status(value: InvoiceStatus) {
    this.table.status = value;
    if (value === "paid") this.table.paidAt ??= new Date(helioNow());
    else this.table.paidAt = undefined;
    this.applyAmounts();
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.issuedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    size: 140,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare issuedAt: Date;

  /** Left empty on a new invoice, the payment terms set it (see numbering.ts). */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.dueAt",
    description: "$helio.finance.invoices.hints.dueAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({
      style: "day",
      soonWithinMs: 7 * DAY_MS,
      soonTone: "warning",
    }),
    size: 140,
  })
  @Mandatory("edit")
  @Access(AccessMode.ReadWrite)
  declare dueAt: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.paidAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare paidAt: Date;

  /**
   * Excluding VAT and the VAT rate are typed in; the VAT, the total and what
   * is due follow.
   */
  @Listable(["amountExcl"])
  @Sortable()
  @Exported(["amountExcl"])
  @Column({
    name: "$helio.finance.invoices.columns.amountExcl",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 165,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  get amountExcl(): number {
    return this.table.amountExcl;
  }
  set amountExcl(value: number) {
    this.table.amountExcl = value;
    this.applyAmounts();
  }

  /** Left empty on a new invoice, the default rate of the settings applies. */
  @Listable(["vatRate"])
  @Exported(["vatRate"])
  @Column({
    name: "$helio.finance.invoices.columns.vatRate",
    description: "$helio.finance.invoices.hints.vatRate",
    type: new DefaultDataTypes.PercentageType({ max: 0.21 }),
    filterable: true,
    isVisible: false,
  })
  @Mandatory("edit")
  @Access(AccessMode.ReadWrite)
  get vatRate(): number {
    return this.table.vatRate;
  }
  set vatRate(value: number) {
    this.table.vatRate = value;
    this.applyAmounts();
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.vatAmount",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare vatAmount: number;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.total",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 165,
  })
  @Access(AccessMode.ReadOnly)
  declare total: number;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.amountDue",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 130,
  })
  @Access(AccessMode.ReadOnly)
  declare amountDue: number;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.paymentMethod",
    type: new DefaultDataTypes.SelectType({ items: [...PAYMENT_METHODS] }),
    filterable: true,
    defaultValue: "transfer",
    size: 195,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare paymentMethod: string;

  /** Stamped by the "Send reminder" action; shown under an overdue status. */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.finance.invoices.columns.remindedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare remindedAt: Date;

  /** Listed so the row rules (edit, archive) can read it in the browser. */
  @Listable()
  @ArchiveField()
  @Access(AccessMode.ReadOnly)
  declare isArchived: boolean;

  /**
   * Shown under the status: when a sent invoice falls due, how late an overdue
   * one is (in red), when a paid one was paid.
   */
  @Listable(["status", "dueAt", "paidAt", "remindedAt"])
  @Access(AccessMode.ReadOnly)
  get statusDetail(): CellSubline | null {
    const { status, dueAt, paidAt, remindedAt } = this.table;
    if (status === "paid" && paidAt) {
      return {
        text: {
          key: "$helio.finance.invoices.detail.paid",
          params: { date: day(paidAt) },
        },
      };
    }
    if (status === "overdue" && dueAt) {
      const late = Math.max(1, daysLate(dueAt));
      const count = { type: "count", value: late } as const;
      return {
        text: remindedAt
          ? {
              key: "$helio.finance.invoices.detail.lateReminded",
              params: { count, date: day(remindedAt) },
            }
          : { key: "$helio.finance.invoices.detail.late", params: { count } },
        tone: "error",
      };
    }
    if (status === "sent" && dueAt) {
      return {
        text: {
          key: "$helio.finance.invoices.detail.due",
          params: { date: day(dueAt) },
        },
      };
    }
    return null;
  }

  private applyAmounts(): void {
    const excl = this.table.amountExcl ?? 0;
    const vatAmount = cents(excl * (this.table.vatRate ?? VAT_RESIDENTIAL));
    this.table.vatAmount = vatAmount;
    this.table.total = cents(excl + vatAmount);
    this.table.amountDue = SETTLED.includes(this.table.status)
      ? 0
      : this.table.total;
  }
}

/** `ControllerClass`-typed alias for relations and pages (see the TS2742 note). */
export type InvoiceRow = {
  [Field in keyof invoiceDataAPI]: invoiceDataAPI[Field];
};

export const invoiceController: ControllerClass<InvoiceRow> = invoiceDataAPI;
