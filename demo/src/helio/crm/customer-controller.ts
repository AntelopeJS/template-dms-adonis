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
import { ReadonlyBehaviorType } from "@antelopejs/interface-dms/base/types";
import {
  ArchiveField,
  type CellSubline,
  Column,
  ColumnGroup,
  DefaultDisplays,
  Exported,
  Select,
  TableViewRoutes,
} from "@antelopejs/interface-dms/base/table-view";
import { Customer, type CustomerKind, CustomerModel } from "./database";
import { salesRepController } from "./sales-rep-controller";

/**
 * The customer kinds a row can take; the pages build their tabs, views and
 * quick filters from it.
 */
export const CUSTOMER_KINDS = [
  {
    value: "residential",
    label: "$helio.crm.kinds.residential",
    icon: "i-ph-house-line",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "business",
    label: "$helio.crm.kinds.business",
    icon: "i-ph-buildings",
    iconColor: "primary",
    textColor: "primary",
  },
] as const;

/** How a customer or a deal reached Helio; shared by customers and deals. */
export const LEAD_SOURCES = [
  {
    value: "website",
    label: "$helio.crm.sources.website",
    icon: "i-ph-globe",
    iconColor: "info",
    textColor: "info",
  },
  {
    value: "referral",
    label: "$helio.crm.sources.referral",
    icon: "i-ph-users-three",
    iconColor: "success",
    textColor: "success",
  },
  {
    value: "fair",
    label: "$helio.crm.sources.fair",
    icon: "i-ph-storefront",
    iconColor: "warning",
    textColor: "warning",
  },
  {
    value: "partner",
    label: "$helio.crm.sources.partner",
    icon: "i-ph-handshake",
    iconColor: "primary",
    textColor: "primary",
  },
  {
    value: "phone",
    label: "$helio.crm.sources.phone",
    icon: "i-ph-phone",
    iconColor: "neutral",
    textColor: "neutral",
  },
] as const;

/** Segments offered while typing; they stay free tags. */
export const CUSTOMER_SEGMENTS = [
  "photovoltaïque",
  "batterie",
  "borne",
  "entretien",
  "agriculture",
  "commerce",
  "industrie",
  "horeca",
  "copropriété",
  "prime",
];

const KIND_ICONS: Record<CustomerKind, string> = {
  residential: "i-ph-house-line",
  business: "i-ph-buildings",
};

/**
 * The customers table's data controller, served under `/api/helio/customers`.
 * Its column groups are the form's cards, in the order their first field is
 * declared.
 *
 * Not exported on purpose: emitting a `.d.ts` for this class would require
 * naming types from the nested `@antelopejs/interface-core` copies (TS2742).
 * Other domains use {@link customerController} instead.
 */
@ColumnGroup("identity", {
  label: "$helio.crm.customers.groups.identity",
  orientation: "vertical",
  description: "$helio.crm.customers.groups.identityHint",
})
@ColumnGroup("contact", {
  label: "$helio.crm.customers.groups.contact",
  orientation: "vertical",
})
@ColumnGroup("location", {
  label: "$helio.crm.customers.groups.location",
  orientation: "vertical",
})
@ColumnGroup("relationship", {
  label: "$helio.crm.customers.groups.relationship",
  orientation: "vertical",
  description: "$helio.crm.customers.groups.relationshipHint",
})
@RegisterDataController()
class customerDataAPI extends DataController(
  Customer,
  TableViewRoutes.All,
  Controller("/api/helio/customers"),
) {
  @ModelReference()
  @Model(CustomerModel)
  declare model: CustomerModel;

  @Select()
  @Listable()
  @Exported()
  @Access(AccessMode.ReadOnly)
  declare _id: string;

  @Searchable()
  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.name",
    group: "identity",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.crm.customers.placeholders.name",
      maxLength: 120,
    }),
    filterable: true,
    size: 280,
    display: new DefaultDisplays.IdentityDisplay({
      iconField: "kindIcon",
      subtitleField: "locationLine",
      badges: [
        {
          field: "isArchived",
          label: "$helio.crm.customers.badges.archived",
          tone: "neutral",
        },
      ],
    }),
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare name: string;

  @Select()
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.kind",
    group: "identity",
    type: new DefaultDataTypes.SelectType({
      items: [...CUSTOMER_KINDS],
      display: "segmented",
    }),
    filterable: true,
    defaultValue: "residential",
    display: new DefaultDisplays.StatusPillDisplay({
      tones: { residential: "info", business: "primary" },
    }),
    size: 160,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare kind: string;

  /**
   * The VAT number, asked of a business only: a business is invoiced with VAT,
   * a household has no number.
   */
  @Searchable()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.vatNumber",
    group: "identity",
    type: new DefaultDataTypes.StringType({
      placeholder: "BE0123.456.749",
      maxLength: 20,
    }),
    filterable: true,
    isVisible: false,
    visibleWhen: { field: "kind", in: ["business"] },
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare vatNumber: string;

  @Searchable()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.contactName",
    group: "contact",
    type: new DefaultDataTypes.StringType({
      placeholder: "$helio.crm.customers.placeholders.contactName",
    }),
    filterable: true,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare contactName: string;

  @Searchable()
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.email",
    group: "contact",
    type: new DefaultDataTypes.EmailType({
      placeholder: "$helio.crm.customers.placeholders.email",
    }),
    filterable: true,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare email: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.phone",
    group: "contact",
    type: new DefaultDataTypes.PhoneType({ placeholder: "+32 4xx xx xx xx" }),
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare phone: string;

  /**
   * The customer's address. Helio works in Belgium, so the country starts
   * filled in; foreign addresses stay possible.
   */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.address",
    group: "location",
    type: new DefaultDataTypes.AddressType({
      autocomplete: { enabled: true, lang: "fr" },
      defaultCountry: "BE",
    }),
    filterable: true,
    isVisible: false,
  })
  @Mandatory("new", "edit")
  @Access(AccessMode.ReadWrite)
  declare address: DefaultDataTypes.Address;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.segments",
    group: "relationship",
    type: new DefaultDataTypes.TagsType({
      max: 6,
      suggestions: CUSTOMER_SEGMENTS,
      placeholder: "$helio.crm.customers.placeholders.segments",
    }),
    filterable: true,
    size: 260,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare segments: string[];

  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.source",
    group: "relationship",
    type: new DefaultDataTypes.SelectType({ items: [...LEAD_SOURCES] }),
    filterable: true,
    defaultValue: "website",
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare source: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.isVip",
    group: "relationship",
    type: new DefaultDataTypes.BooleanType({
      label: "$helio.crm.customers.vipSwitch",
    }),
    filterable: true,
    defaultValue: false,
    display: new DefaultDisplays.IndicatorDisplay({
      onLabel: "$helio.crm.customers.badges.vip",
      offLabel: "$helio.crm.customers.standard",
      onIcon: "i-ph-star-fill",
      offIcon: "i-ph-star",
      onTone: "warning",
    }),
    size: 110,
  })
  @Access(AccessMode.ReadWrite)
  declare isVip: boolean;

  /** The sales rep who follows the account. */
  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.owner",
    group: "relationship",
    type: new DefaultDataTypes.RelationType({
      dataApiController: salesRepController,
      keyMapping: { label: "name", value: "_id", avatar: "avatar" },
      deselectable: true,
      placeholder: "$helio.crm.customers.placeholders.owner",
    }),
    filterable: true,
    size: 190,
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare owner: string;

  @Listable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.website",
    group: "contact",
    type: new DefaultDataTypes.UrlType({ placeholder: "https://…" }),
    isVisible: false,
    visibleWhen: { field: "kind", in: ["business"] },
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare website: string;

  @Column({
    name: "$helio.crm.customers.columns.notes",
    type: new DefaultDataTypes.RichTextType({
      placeholder: "$helio.crm.customers.placeholders.notes",
    }),
  })
  @Optional()
  @Access(AccessMode.ReadWrite)
  declare notes: string;

  /**
   * When the customer was created, stamped on creation and hidden from the new
   * form.
   */
  @Listable()
  @Sortable()
  @Exported()
  @Column({
    name: "$helio.crm.customers.columns.createdAt",
    type: new DefaultDataTypes.DateType(),
    filterable: true,
    display: new DefaultDisplays.RelativeDateDisplay({ style: "day" }),
    size: 180,
    readonlyBehavior: { new: ReadonlyBehaviorType.hidden },
  })
  @Access(AccessMode.ReadOnly)
  declare createdAt: Date;

  @ArchiveField()
  @Access(AccessMode.ReadOnly)
  declare isArchived: boolean;

  /** The tile of the identity cell: a house or a building. */
  @Listable(["kind"])
  @Access(AccessMode.ReadOnly)
  get kindIcon(): string {
    return KIND_ICONS[this.table.kind];
  }

  /**
   * The identity cell's second line: contact person and city, as written. A VIP
   * account opens it with "VIP", in amber: a badge beside the name would
   * squeeze the name to a few letters on a phone.
   */
  @Listable(["contactName", "address", "isVip"])
  @Access(AccessMode.ReadOnly)
  get locationLine(): CellSubline | string {
    const city = this.table.address?.city;
    const line = [this.table.contactName, city].filter(Boolean).join(" · ");
    if (!this.table.isVip) return line;
    return { text: line ? `VIP · ${line}` : "VIP", tone: "warning" };
  }
}

/**
 * The customer controller, typed as `ControllerClass` for the relation columns
 * of other domains (see the TS2742 note on the class).
 */
export type CustomerRow = {
  [Field in keyof customerDataAPI]: customerDataAPI[Field];
};

export const customerController: ControllerClass<CustomerRow> = customerDataAPI;
