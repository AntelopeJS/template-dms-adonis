import {
  Controller,
  Get,
  HTTPResult,
  Parameter,
} from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import {
  type ConfirmDialogSerialized,
  serializeConfirmDialog,
} from "@antelopejs/interface-dms/base/table-view";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import { countCustomerDeals } from "./customer-deals";
import { customersTableAction } from "./customers-page";
import { CustomerModel } from "./database";
import { CRM_API } from "./links";

/** Routes of the CRM pages that no data controller generates. */
export class HelioCrmRoutes extends Controller(CRM_API) {
  /**
   * The delete dialog of one customer: type its name to confirm. It refuses
   * outright while the customer is active (only an archived customer can go, in
   * archive mode) or has deals still in play, as the delete guard does. Closed
   * deals stay for the history, without their customer.
   */
  @Get("customers/:id/delete-confirm")
  async deleteConfirm(
    @Parameter("id", "param") customerId: string,
    @AuthUserWithPermission(customersTableAction("delete")) _user:
      | boolean
      | User,
  ): Promise<ConfirmDialogSerialized> {
    const customer = await GetModel(CustomerModel).get(customerId);
    if (!customer) {
      throw new HTTPResult(404, {
        message: "$helio.crm.customers.errors.notFound",
      });
    }
    if (!customer.isArchived) {
      return serializeConfirmDialog({
        title: "$helio.crm.customers.deleteConfirm.activeTitle",
        description: "$helio.crm.customers.deleteConfirm.activeDescription",
        params: { name: customer.name },
        icon: "i-ph-archive",
        color: "warning",
        blocked: true,
      });
    }
    const deals = await countCustomerDeals([customerId]);
    if (deals.open > 0) {
      return serializeConfirmDialog({
        title: "$helio.crm.customers.deleteConfirm.blockedTitle",
        description: "$helio.crm.customers.deleteConfirm.blockedDescription",
        params: { name: customer.name, count: deals.open },
        icon: "i-ph-lock-simple",
        color: "warning",
        blocked: true,
      });
    }
    return serializeConfirmDialog({
      title: "$helio.crm.customers.deleteConfirm.title",
      description: "$helio.crm.customers.deleteConfirm.description",
      params: { name: customer.name },
      icon: "i-ph-trash",
      color: "error",
      confirmLabel: "$helio.crm.customers.deleteConfirm.confirm",
      confirmText: customer.name,
      impact:
        deals.closed > 0
          ? [
              {
                icon: "i-ph-kanban",
                label: "$helio.crm.customers.deleteConfirm.impactDeals",
                count: deals.closed,
              },
            ]
          : undefined,
    });
  }
}
