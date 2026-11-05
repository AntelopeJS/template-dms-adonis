import { HTTPResult } from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import type { Action } from "@antelopejs/interface-dms/component";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import {
  ResourceForm,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { helioSalesCategory } from "../category";
import { isText } from "../shared/json";
import { helioQuickActions } from "../shared/quick-actions";
import { CUSTOMER_KINDS, customerController } from "./customer-controller";
import { countCustomerDeals } from "./customer-deals";
import { afterCustomerEdit } from "./customer-names";
import { CustomerModel } from "./database";
import { isValidVatNumber } from "./vat-number";
import {
  CUSTOMER_DELETE_CONFIRM_URL,
  INVOICES_URL,
  PIPELINE_URL,
  PROJECTS_URL,
  QUOTES_URL,
} from "./links";

/**
 * Refuses a VAT number that is not valid, whichever client sent it. The
 * guards call it only for a non-blank string: a blank number passes, because
 * the column asks for one, mandatory, from a business only
 * (`customer-controller.ts`; a customer turned household loses the number and
 * website it stored).
 */
function assertVatFormat(vatNumber: string): void {
  if (!isValidVatNumber(vatNumber)) {
    throw new HTTPResult(400, {
      message: "$helio.crm.customers.errors.vatFormat",
      field: "vatNumber",
    });
  }
}

async function refuseActiveCustomers(ids: string[]): Promise<void> {
  const model = GetModel(CustomerModel);
  const customers = await Promise.all(ids.map((id) => model.get(id)));
  if (customers.some((customer) => customer && !customer.isArchived)) {
    throw new HTTPResult(409, {
      message: "$helio.crm.customers.errors.notArchived",
    });
  }
}

@RegisterPage()
export class PageHelioCustomers extends PageController(
  "customers",
  {
    displayName: "$helio.crm.customers.nav",
    description: "$helio.crm.customers.description",
    icon: "i-ph-address-book",
    category: helioSalesCategory,
    order: 2,
  },
  DefaultLayout({ fullWidth: true }),
) {
  /**
   * The customers table.
   *
   * - VIP accounts stay on top of their page, whatever the sort.
   * - `?segment=<tag>` filters on a segment: the dashboard and the segment
   *   chips link that way.
   * - The generated form pages show the business fields through their columns'
   *   `visibleWhen`, following the customer type.
   * - Only archived customers can be deleted (archive mode): the rule keeps the
   *   action off the active ones, on the selection bar too, and the dialog,
   *   worded by the server, asks to type the customer's name. The delete guard
   *   also refuses an active customer, or one with deals still in play: the
   *   dialog says so, and a bare API call is refused the same way instead of
   *   deleting nothing.
   * - The quick view is a right drawer showing the customer's own table form,
   *   read-only, for the row clicked or the one `?record=<id>` names.
   * - The invoices action opens every status of the customer's invoices,
   *   whatever tab was left open.
   * - A rename reaches the deals and quotes that carry the name for the search.
   */
  static table = TableView(customerController, {
    caption: "$helio.crm.customers.caption",
    labelKey: "name",
    searchPlaceholder: "$helio.crm.customers.search",
    archiveMode: true,
    pinnedRows: { field: "isVip", equals: true },
    defaultSort: { field: "name" },
    pageSize: 25,
    rowClick: "single",
    quickFilters: [
      { field: "owner", label: "$helio.crm.customers.quickFilters.owner" },
      { field: "source", label: "$helio.crm.customers.quickFilters.source" },
    ],
    tabs: CUSTOMER_KINDS.map((kind) => ({
      id: kind.value,
      label: kind.label,
      icon: kind.icon,
      iconColor: kind.iconColor,
      textColor: kind.textColor,
      filter: { accessorKey: "kind", value: kind.value, mode: "is" },
    })),
    queryParamFilters: {
      segment: {
        field: "segments",
        mode: "include",
        visible: true,
        label: "$helio.crm.customers.segmentChip",
      },
    },
    footer: {
      countLabel: "$helio.crm.customers.count",
      summary: [
        {
          label: "$helio.crm.customers.summary.vip",
          op: "count",
          where: { field: "isVip", equals: true },
        },
        {
          label: "$helio.crm.customers.summary.business",
          op: "count",
          where: { field: "kind", equals: "business" },
        },
      ],
      legend: "kind",
    },
    emptyStates: {
      firstRun: {
        title: "$helio.crm.customers.empty.firstRunTitle",
        description: "$helio.crm.customers.empty.firstRunDescription",
        icon: "i-ph-address-book",
      },
      filtered: {
        title: "$helio.crm.customers.empty.filteredTitle",
        description: "$helio.crm.customers.empty.filteredDescription",
      },
    },
    formContainer: {
      type: "page",
      pages: {
        new: {
          displayName: "$helio.crm.customers.form.newTitle",
          description: "$helio.crm.customers.form.newDescription",
        },
        edit: { displayName: "$helio.crm.customers.form.editTitle" },
        details: { displayName: "$helio.crm.customers.form.detailsTitle" },
      },
    },
    rowActions: {
      add: {
        isEnabled: true,
        label: "$helio.crm.customers.newCustomer",
        icon: "i-ph-plus",
      },
      edit: true,
      copyLink: true,
      hasSelection: true,
      menuLabel: "$helio.crm.customers.menuLabel",
      archive: {
        isEnabled: true,
        successMessage: "$helio.crm.customers.archived",
      },
      restore: {
        isEnabled: true,
        successMessage: "$helio.crm.customers.restored",
      },
      delete: {
        isEnabled: true,
        rule: { field: "isArchived", equals: true },
        confirm: { from: CUSTOMER_DELETE_CONFIRM_URL },
      },
      custom: [
        {
          id: "quick-view",
          label: "$helio.crm.customers.quickView.action",
          icon: "i-ph-sidebar-simple",
          isDefault: true,
          target: {
            type: "drawer",
            direction: "right",
            title: "$helio.crm.customers.quickView.title",
            description: "$helio.crm.customers.quickView.description",
            rowTitle: "{name}",
            positionLabel: "$helio.crm.customers.quickView.position",
            deepLink: true,
            notFound: {
              title: "$helio.crm.customers.quickView.notFoundTitle",
              description: "$helio.crm.customers.quickView.notFoundDescription",
            },
            component: ResourceForm(customerController, {
              mode: "view",
              rowId: "{{row._id}}",
            }),
          },
        },
        {
          id: "deals",
          label: "$helio.crm.customers.actions.deals",
          icon: "i-ph-kanban",
          target: { type: "page", url: `${PIPELINE_URL}?customer={{row._id}}` },
        },
        {
          id: "quotes",
          label: "$helio.crm.customers.actions.quotes",
          icon: "i-ph-file-text",
          target: { type: "page", url: `${QUOTES_URL}?customer={{row._id}}` },
        },
        {
          id: "projects",
          label: "$helio.crm.customers.actions.projects",
          icon: "i-ph-hard-hat",
          target: {
            type: "page",
            url: `${PROJECTS_URL}?customer={{row._id}}&table.view=all`,
          },
        },
        {
          id: "invoices",
          label: "$helio.crm.customers.actions.invoices",
          icon: "i-ph-receipt",
          target: {
            type: "page",
            url: `${INVOICES_URL}?customer={{row._id}}&table.tab=all`,
          },
        },
        {
          id: "email",
          label: "$helio.crm.customers.actions.email",
          icon: "i-ph-envelope-simple",
          target: { type: "external", url: "mailto:{{row.email}}" },
        },
      ],
    },
    guards: {
      new: (_ctx, { body }) => {
        if (isText(body.vatNumber) && body.vatNumber.trim() !== "")
          assertVatFormat(body.vatNumber);
      },
      edit: (_ctx, { body, current }) => {
        if (isText(body.vatNumber) && body.vatNumber.trim() !== "")
          assertVatFormat(body.vatNumber);
        const renamed = body.name !== undefined && body.name !== current.name;
        return renamed ? afterCustomerEdit : undefined;
      },
      delete: async (_ctx, { ids }) => {
        await refuseActiveCustomers(ids);
        const { open } = await countCustomerDeals(ids);
        if (open > 0) {
          throw new HTTPResult(409, {
            message: "$helio.crm.customers.errors.openDeals",
          });
        }
      },
    },
  });
}

QuickAction("helio-new-customer", {
  category: helioQuickActions,
  displayName: "$helio.crm.customers.quickAction",
  icon: "i-ph-user-plus",
  target: {
    type: "openForm",
    page: PageHelioCustomers,
    component: PageHelioCustomers.table,
  },
});

/**
 * One of the customers table's own actions (`add`, `edit`, `delete`…): the
 * routes written by hand answer to the permission of the
 * action they stand for.
 */
export function customersTableAction(id: string): Action {
  const action = PageHelioCustomers.table.getAction(id);
  if (!action) throw new Error(`The customers table has no "${id}" action`);
  return action;
}
