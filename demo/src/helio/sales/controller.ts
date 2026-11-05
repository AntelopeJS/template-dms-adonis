import { randomBytes } from "node:crypto";
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
  type CellSubline,
  Column,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import {
  type ComposedText,
  ReadonlyBehaviorType,
} from "@antelopejs/interface-dms/base/types";
import { onSaleProductController } from "../catalog/controller";
import { customerController, dealController } from "../crm/controller";
import { currentSettings } from "../settings/current";
import { isBlank, textOf, withBodyDefaults } from "../shared/body-defaults";
import { DAY_MS } from "../shared/seed";
import { Quote, type QuoteLine, QuoteModel } from "./database";
import { quoteTotals, VAT_RESIDENTIAL } from "./lines";
import { takeQuoteNumber } from "./numbering";
import { defaultVatRate } from "./vat-rate";
import { EXPIRING_WITHIN_MS, QUOTE_STATUSES, VALIDITY_DAYS } from "./options";
import { lineText, otherLinesText } from "./summary";
import { helioNow } from "../shared/clock";

export { QUOTE_STATUSES } from "./options";

const day = (date: Date) =>
  ({ type: "date", value: date.toISOString(), format: "day" }) as const;

/**
 * For the fields the system writes (number, status, dates of the life cycle):
 * absent from the creation form, shown read-only afterwards.
 */
const HIDDEN_ON_NEW = { new: ReadonlyBehaviorType.hidden };

/**
 * A line slot of the expanded row: hidden from the grid and the forms, read for
 * the band only. It displays the line's composed text ("12 × … · €2,268.00"),
 * and the next line under it when `subField` names it.
 */
const lineSlot = (name: string, subField?: string) => ({
  name,
  type: new DefaultDataTypes.StringType(),
  isVisible: false,
  validate: false,
  readonlyBehavior: ReadonlyBehaviorType.hidden,
  display: new DefaultDisplays.TwoLineDisplay({ subField }),
});

/**
 * The data API of the quotes. Not exported on purpose: emitting a .d.ts for
 * this class would require naming types from the nested
 * @antelopejs/interface-core copies (TS2742); `quoteController` is the typed
 * alias to import. Left empty, the VAT rate of a new quote is the default one
 * of the Settings page.
 */
@RegisterDataController()
class quoteDataAPI extends DataController(
  Quote,
  {
    ...TableViewRoutes.All,
    new: withBodyDefaults(TableViewRoutes.New, async (body) => {
      if (isBlank(body.vatRate))
        body.vatRate = await defaultVatRate(
          textOf(body.customer),
          await currentSettings(),
        );
    }),
  },
  Controller("/api/helio/quotes"),
) {
  @ModelReference()
  @Model(QuoteModel)
  declare model: QuoteModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  /** Given on creation (see `creation`), never typed in. */
  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.number",
    type: new DefaultDataTypes.StringType({ maxLength: 20 }),
    filterable: true,
    size: 160,
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.TwoLineDisplay({ subField: "linesSummary" }),
  })
  @Access(AccessMode.ReadOnly)
  declare number: string;

  @Select()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.customer",
    type: new DefaultDataTypes.RelationType({
      dataApiController: customerController,
      keyMapping: { label: "name", value: "_id" },
      placeholder: "$helio.sales.quotes.placeholders.customer",
      addForm: {
        displayName: "$helio.sales.quotes.addCustomer.title",
        description: "$helio.sales.quotes.addCustomer.description",
      },
    }),
    filterable: true,
    size: 190,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare customer: string;

  /**
   * The customer's name, stored with the quote (customer-names.ts keeps it in
   * step) so the search box finds a quote by its customer: a search reads the
   * stored fields, not the joined customer.
   */
  @Searchable()
  @Column({
    name: "$helio.sales.quotes.columns.customerName",
    type: new DefaultDataTypes.StringType(),
    validate: false,
    isVisible: false,
    readonlyBehavior: ReadonlyBehaviorType.hidden,
  })
  @Access(AccessMode.ReadOnly)
  declare customerName: string;

  @Listable()
  @Column({
    name: "$helio.sales.quotes.columns.deal",
    type: new DefaultDataTypes.RelationType({
      dataApiController: dealController,
      keyMapping: { label: "title", value: "_id" },
      placeholder: "$helio.sales.quotes.placeholders.deal",
      deselectable: true,
    }),
    filterable: true,
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare deal: string;

  /**
   * Moved by the row actions (send, accept, reject), which also stamp the
   * matching date: a form editing it would leave those dates behind.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.status",
    type: new DefaultDataTypes.SelectType({ items: [...QUOTE_STATUSES] }),
    filterable: true,
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.StatusPillDisplay({
      tones: {
        draft: "neutral",
        sent: "info",
        accepted: "success",
        rejected: "error",
        expired: "warning",
      },
      subField: "statusDetail",
      subTone: "muted",
      liveValues: ["sent"],
    }),
    size: 170,
  })
  @Access(AccessMode.ReadOnly)
  declare status: string;

  /**
   * The lines are the source of truth: writing them (or the VAT rate)
   * recomputes subtotal and total, so the stored amounts always add up. The
   * products offered are the catalog's products on sale, read live: a new
   * product can be quoted at once, a discontinued one no longer.
   */
  @Listable(["lines"])
  @Column({
    name: "$helio.sales.quotes.columns.lines",
    type: new DefaultDataTypes.ArrayType({
      of: {
        product: {
          type: new DefaultDataTypes.RelationType({
            dataApiController: onSaleProductController,
            keyMapping: { label: "name", value: "_id" },
            placeholder: "$helio.sales.quotes.placeholders.product",
          }),
          label: "$helio.sales.quotes.lines.product",
          required: true,
        },
        label: {
          type: new DefaultDataTypes.StringType({ maxLength: 160 }),
          label: "$helio.sales.quotes.lines.label",
          required: true,
        },
        qty: {
          type: new DefaultDataTypes.NumberType({ min: 0, step: 1 }),
          label: "$helio.sales.quotes.lines.qty",
          required: true,
        },
        unitPrice: {
          type: new DefaultDataTypes.PriceType(),
          label: "$helio.sales.quotes.lines.unitPrice",
          required: true,
        },
      },
      sortable: true,
      min: 1,
      addLabel: "$helio.sales.quotes.lines.add",
    }),
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  get lines(): QuoteLine[] {
    return this.table.lines;
  }
  set lines(value: QuoteLine[]) {
    this.table.lines = value;
    this.applyTotals();
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.subtotal",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 150,
    readonlyBehavior: HIDDEN_ON_NEW,
  })
  @Access(AccessMode.ReadOnly)
  declare subtotal: number;

  @Listable(["vatRate"])
  @Exported(["vatRate"])
  @Column({
    name: "$helio.sales.quotes.columns.vatRate",
    description: "$helio.sales.quotes.hints.vatRate",
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
    this.applyTotals();
  }

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.total",
    type: new DefaultDataTypes.PriceType(),
    filterable: true,
    size: 150,
    readonlyBehavior: HIDDEN_ON_NEW,
  })
  @Access(AccessMode.ReadOnly)
  declare total: number;

  /**
   * A new quote is issued today and holds VALIDITY_DAYS (see `creation`);
   * sending it renews a validity that ran out. Read-only in the forms: they
   * only read a field's default access mode, not its per-action overrides, so
   * "writable on edit only" cannot be shown.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.issuedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    size: 130,
  })
  @Access(AccessMode.ReadOnly)
  declare issuedAt: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.validUntil",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.RelativeDateDisplay({
      soonWithinMs: EXPIRING_WITHIN_MS,
      soonTone: "warning",
      pastStyle: "day",
      pastTone: "dimmed",
    }),
    size: 140,
  })
  @Access(AccessMode.ReadOnly)
  declare validUntil: Date;

  @Listable()
  @Sortable()
  @Column({
    name: "$helio.sales.quotes.columns.sentAt",
    type: new DefaultDataTypes.DateType(),
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.RelativeDateDisplay(),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare sentAt: Date;

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.sales.quotes.columns.signedAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    readonlyBehavior: HIDDEN_ON_NEW,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare signedAt: Date;

  @Column({
    name: "$helio.sales.quotes.columns.notes",
    type: new DefaultDataTypes.StringType({
      textarea: true,
      rows: 3,
      placeholder: "$helio.sales.quotes.placeholders.notes",
    }),
    isVisible: false,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare notes: string;

  /**
   * Given by the "Mark as rejected" action, apart from the notes so it reads
   * the same in any language: only the reason itself is the user's text. Read
   * on the details only: no form writes it.
   */
  @Listable()
  @Column({
    name: "$helio.sales.quotes.columns.rejectionReason",
    type: new DefaultDataTypes.StringType({ maxLength: 200, fallback: "—" }),
    readonlyBehavior: {
      new: ReadonlyBehaviorType.hidden,
      edit: ReadonlyBehaviorType.hidden,
    },
    isVisible: false,
  })
  @Access(AccessMode.ReadOnly)
  declare rejectionReason: string;

  /** VAT of the quote, for the expanded row and the document. */
  @Listable(["subtotal", "total"])
  @Column({
    name: "$helio.sales.quotes.columns.vatAmount",
    type: new DefaultDataTypes.PriceType(),
    validate: false,
    isVisible: false,
    readonlyBehavior: ReadonlyBehaviorType.hidden,
  })
  @Access(AccessMode.ReadOnly)
  get vatAmount(): number {
    return (
      Math.round(((this.table.total ?? 0) - (this.table.subtotal ?? 0)) * 100) /
      100
    );
  }

  /**
   * The expanded row's lines, in two slots that always have something to say:
   * the first line with the second under it (`secondLine`), then the rest
   * (`otherLines`).
   */
  @Listable(["lines"])
  @Column(lineSlot("$helio.sales.quotes.columns.firstLines", "secondLine"))
  @Access(AccessMode.ReadOnly)
  get firstLine(): ComposedText | null {
    return lineText(this.table.lines, 0);
  }

  @Listable(["lines"])
  @Access(AccessMode.ReadOnly)
  get secondLine(): ComposedText | null {
    return lineText(this.table.lines, 1);
  }

  @Listable(["lines"])
  @Column(lineSlot("$helio.sales.quotes.columns.otherLines"))
  @Access(AccessMode.ReadOnly)
  get otherLines(): ComposedText {
    return otherLinesText(this.table.lines);
  }

  /** Under the number: the first line and how many follow. */
  @Listable(["lines"])
  @Access(AccessMode.ReadOnly)
  get linesSummary(): ComposedText | null {
    const [first, ...others] = this.table.lines ?? [];
    if (!first) return null;
    return {
      key: "$helio.sales.quotes.linesSummary",
      params: {
        label: first.label,
        count: { type: "count", value: others.length },
      },
    };
  }

  /**
   * Under the status pill: when it was signed, why it was turned down, or until
   * when it holds (orange in its last week).
   */
  @Listable(["status", "validUntil", "signedAt", "rejectionReason"])
  @Access(AccessMode.ReadOnly)
  get statusDetail(): CellSubline | null {
    const { status, validUntil, signedAt, rejectionReason } = this.table;
    if (status === "rejected" && rejectionReason) {
      return {
        text: {
          key: "$helio.sales.quotes.detail.rejected",
          params: { reason: rejectionReason },
        },
      };
    }
    if (status === "accepted" && signedAt) {
      return {
        text: {
          key: "$helio.sales.quotes.detail.signed",
          params: { date: day(signedAt) },
        },
      };
    }
    if ((status === "sent" || status === "draft") && validUntil) {
      const soon = validUntil.getTime() - helioNow() < EXPIRING_WITHIN_MS;
      return {
        text: {
          key: "$helio.sales.quotes.detail.validUntil",
          params: { date: day(validUntil) },
        },
        tone: soon && status === "sent" ? "warning" : undefined,
      };
    }
    return null;
  }

  /**
   * Not a column, so no form shows it; writable on "new" only, so the data API
   * calls this setter once per creation, whatever the body holds. It gives the
   * quote what the system owns: its number, a draft status, its dates and the
   * secret of its portal link.
   */
  @Access(AccessMode.ReadOnly, { new: AccessMode.ReadWrite })
  get creation(): undefined {
    return undefined;
  }
  set creation(_value: undefined) {
    const issuedAt = new Date(helioNow());
    this.table.issuedAt = issuedAt;
    this.table.validUntil = new Date(
      issuedAt.getTime() + VALIDITY_DAYS * DAY_MS,
    );
    this.table.status = "draft";
    this.table.number = takeQuoteNumber(issuedAt);
    this.table.portalToken = randomBytes(12).toString("hex");
  }

  private applyTotals(): void {
    const { subtotal, total } = quoteTotals(
      this.table.lines ?? [],
      this.table.vatRate ?? VAT_RESIDENTIAL,
    );
    this.table.subtotal = subtotal;
    this.table.total = total;
  }
}

/** The quotes data API typed as a `ControllerClass`, for relations and pages (see the TS2742 note on the class). */
export type QuoteRow = { [Field in keyof quoteDataAPI]: quoteDataAPI[Field] };

export const quoteController: ControllerClass<QuoteRow> = quoteDataAPI;
