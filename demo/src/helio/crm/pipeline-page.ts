import {
  type FormBuilder,
  FormEvents,
  FormFunctions,
} from "@antelopejs/interface-dms/base/form";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import {
  ResourceForm,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { helioSalesCategory } from "../category";
import type { RowActionRule } from "@antelopejs/interface-dms/base/types/row-action";
import {
  dealController,
  type DealRow,
  STAGE_PROBABILITY,
} from "./deal-controller";
import { afterDealEdit, afterDealNew } from "./deal-derived";
import { CUSTOMER_QUICK_VIEW_URL } from "./links";
import { PIPELINE_VIEWS } from "./pipeline-views";

/**
 * Deals still in play, for the footer figures: a summary rule reads stored
 * fields, so it names the closed stages rather than the computed `isOpen`.
 */
const OPEN_DEAL: RowActionRule<DealRow> = {
  field: "stage",
  notIn: ["won", "lost"],
};

/**
 * The probability each stage starts a deal with (100 % won, 0 % lost), which
 * {@link watchProbability} applies as the stage is picked.
 */
const PROBABILITY_BY_STAGE = { ...STAGE_PROBABILITY };

/**
 * Makes the probability follow the stage as it is picked, before the save: each
 * stage's usual figure, which the owner may still adjust on an open deal (the
 * column locks it on a won or lost one). Only a change writes the value: a form
 * opens with the probability the deal stored.
 */
function watchProbability(form: FormBuilder): FormBuilder {
  return form.watch(FormEvents.FIELD_CHANGE, FormFunctions.SET_FIELD_VALUE, {
    params: { targetField: "probability", valueMap: PROBABILITY_BY_STAGE },
    onParam: { key: "fieldId", value: "stage" },
  });
}

@RegisterPage()
export class PageHelioPipeline extends PageController(
  "pipeline",
  {
    displayName: "$helio.crm.pipeline.nav",
    description: "$helio.crm.pipeline.description",
    icon: "i-ph-kanban",
    category: helioSalesCategory,
    order: 0,
  },
  DefaultLayout({ fullWidth: true }),
) {
  /**
   * The pipeline table.
   *
   * - The board comes first: one column per stage, and a card moved to another
   *   column changes the deal's stage. The grid stays one click away.
   * - `?customer=<id>` (a customer's "Deals" on the customers page) and
   *   `?owner=<id>` (a sales rep on the dashboard leaderboard) filter the
   *   deals, shown as chips.
   * - A click on a deal (a card of the board or a row), its "Quick view" and
   *   `?record=<deal id>` (the dashboard's activity feed, a customer's deals)
   *   open the deal read-only in a right drawer; "Edit" from the menu opens the
   *   form.
   * - The guards keep the stored derived fields in step after each write (see
   *   `deal-derived.ts`).
   */
  static table = TableView(dealController, {
    caption: "$helio.crm.pipeline.caption",
    labelKey: "title",
    searchPlaceholder: "$helio.crm.pipeline.search",
    rowClick: "single",
    kanban: { groupByField: "stage", draggable: true, columnMaxHeight: "68vh" },
    displays: [{ id: "kanban" }, { id: "table" }],
    defaultDisplay: "kanban",
    card: { fields: ["customer", "amount", "expectedClose", "owner"] },
    defaultSort: { field: "expectedClose" },
    pageSize: 25,
    quickFilters: [
      { field: "owner", label: "$helio.crm.pipeline.quickFilters.owner" },
      { field: "source", label: "$helio.crm.pipeline.quickFilters.source" },
    ],
    queryParamFilters: {
      customer: {
        field: "customer",
        visible: true,
        label: "$helio.crm.pipeline.customerChip",
      },
      owner: {
        field: "owner",
        visible: true,
        label: "$helio.crm.pipeline.ownerChip",
      },
    },
    views: PIPELINE_VIEWS,
    footer: {
      countLabel: "$helio.crm.pipeline.count",
      summary: [
        {
          label: "$helio.crm.pipeline.summary.open",
          field: "amount",
          op: "sum",
          where: OPEN_DEAL,
        },
        {
          label: "$helio.crm.pipeline.summary.weighted",
          field: "weightedAmount",
          op: "sum",
          where: OPEN_DEAL,
        },
        {
          label: "$helio.crm.pipeline.summary.won",
          field: "amount",
          op: "sum",
          where: { field: "stage", equals: "won" },
        },
      ],
      legend: "stage",
    },
    emptyStates: {
      firstRun: {
        title: "$helio.crm.pipeline.empty.firstRunTitle",
        description: "$helio.crm.pipeline.empty.firstRunDescription",
        icon: "i-ph-kanban",
      },
      filtered: {
        title: "$helio.crm.pipeline.empty.filteredTitle",
        description: "$helio.crm.pipeline.empty.filteredDescription",
      },
    },
    formContainer: {
      type: "drawer",
      pages: {
        new: {
          displayName: "$helio.crm.pipeline.form.newTitle",
          description: "$helio.crm.pipeline.form.newDescription",
        },
        edit: { displayName: "$helio.crm.pipeline.form.editTitle" },
        details: { displayName: "$helio.crm.pipeline.form.detailsTitle" },
      },
    },
    rowActions: {
      add: {
        isEnabled: true,
        label: "$helio.crm.pipeline.newDeal",
        icon: "i-ph-plus",
      },
      edit: true,
      duplicate: true,
      copyLink: true,
      hasSelection: true,
      menuLabel: "$helio.crm.pipeline.menuLabel",
      delete: {
        isEnabled: true,
        successMessage: "$helio.crm.pipeline.deleted",
        confirm: {
          title: "$helio.crm.pipeline.deleteConfirm.title",
          description: "$helio.crm.pipeline.deleteConfirm.description",
          icon: "i-ph-trash",
          color: "error",
          confirmLabel: "$helio.crm.pipeline.deleteConfirm.confirm",
        },
      },
      custom: [
        {
          id: "quick-view",
          label: "$helio.crm.pipeline.quickView.action",
          icon: "i-ph-sidebar-simple",
          isDefault: true,
          target: {
            type: "drawer",
            direction: "right",
            title: "$helio.crm.pipeline.quickView.title",
            description: "$helio.crm.pipeline.quickView.description",
            rowTitle: "{title}",
            positionLabel: "$helio.crm.pipeline.quickView.position",
            deepLink: true,
            notFound: {
              title: "$helio.crm.pipeline.quickView.notFoundTitle",
              description: "$helio.crm.pipeline.quickView.notFoundDescription",
            },
            component: ResourceForm(dealController, {
              mode: "view",
              rowId: "{{row._id}}",
            }),
          },
        },
        {
          id: "customer",
          label: "$helio.crm.pipeline.actions.customer",
          icon: "i-ph-address-book",
          target: { type: "page", url: CUSTOMER_QUICK_VIEW_URL },
        },
      ],
    },
    forms: {
      new: watchProbability,
      edit: watchProbability,
    },
    guards: {
      new: (_ctx, { body }) => afterDealNew(body),
      edit: (_ctx, { id, body, current }) => afterDealEdit(id, body, current),
    },
  });
}
