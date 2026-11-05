import {
  Context,
  Get,
  HTTPResult,
  JSONBody,
  MultiParameter,
  Parameter,
  Post,
  type RequestContext,
} from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import {
  StatGroup,
  type StatGroupItem,
} from "@antelopejs/interface-dms/base/stat-group";
import {
  serializeConfirmDialog,
  tableViewLink,
} from "@antelopejs/interface-dms/base/table-view";
import type { ConfirmDialogSerialized } from "@antelopejs/interface-dms/base/types/confirm-dialog";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import {
  NotifyMenuChanged,
  PageController,
  pageRoutePath,
  RegisterPage,
} from "@antelopejs/interface-dms/page";
import { QuickAction } from "@antelopejs/interface-dms/quick-actions";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { getRequestTenantId } from "@antelopejs/interface-dms/request-tenant";
import { helioCategory } from "../category";
import { helioQuickActions } from "../shared/quick-actions";
import {
  cancelInvoices,
  markInvoicesPaid,
  type PaymentInput,
  remindInvoices,
  sweepOverdueInvoices,
} from "./actions";
import { InvoiceModel } from "./database";
import { loadDocumentData, renderInvoiceDocument } from "./document";
import { invoiceKpis } from "./kpis";
import {
  INVOICES_PAGE_PATH,
  INVOICES_TOPIC,
  invoiceEditAction,
  invoiceListAction,
  invoicesTable,
  markPaidFields,
} from "./table";
import { helioNow } from "../shared/clock";

const HTTP_NOT_FOUND = 404;

/** What a payment or a reminder answers: how many invoices it changed. */
interface ActionResult {
  count: number;
}

@RegisterPage()
export class PageHelioInvoices extends PageController(
  "invoices",
  {
    displayName: "$helio.finance.nav.invoices",
    description: "$helio.finance.page.description",
    icon: "i-ph-receipt",
    category: helioCategory,
    order: 3,
  },
  DefaultLayout({ fullWidth: true }),
) {
  /**
   * The KPI strip above the table. It reads the page's own `kpis` route and
   * again whenever invoices are paid or reminded, so it follows the table.
   */
  static kpis = StatGroup({
    label: "$helio.finance.kpis.label",
    layout: "cards",
    columns: 4,
    fetchUrl: pageRoutePath(INVOICES_PAGE_PATH, "/kpis"),
    realtimeTopic: INVOICES_TOPIC,
    skeletonCount: 4,
  });

  static table = invoicesTable;

  /**
   * Computes the strip's cells. Each link names the "all" tab as well as the
   * view, since a tab remembered from an earlier visit would otherwise narrow
   * the list the card counts.
   */
  @Get("kpis")
  async kpis(
    @AuthUserWithPermission(invoiceListAction) _user: User,
  ): Promise<{ items: StatGroupItem[] }> {
    await sweepOverdueInvoices();
    const link = (target: { tab?: string; view?: string }) =>
      tableViewLink(PageHelioInvoices, "table", target);
    const items = await invoiceKpis({
      overdue: link({ tab: "overdue" }),
      outstanding: link({ tab: "all", view: "outstanding" }),
      paid: link({ tab: "all", view: "paid-recently" }),
    });
    return { items };
  }

  @Get(":id/document")
  async document(
    @Parameter("id") id: string,
    @AuthUserWithPermission(invoiceListAction) user: User,
  ): Promise<HTTPResult> {
    const invoice = await GetModel(InvoiceModel).get(id);
    if (!invoice) throw new HTTPResult(HTTP_NOT_FOUND, "Invoice not found");
    const html = renderInvoiceDocument(
      await loadDocumentData(invoice),
      user.language,
    );
    return HTTPResult.withHeaders(
      new HTTPResult(200, html, "text/html; charset=utf-8"),
      {
        "Content-Disposition": `attachment; filename="${invoice.number}.html"`,
      },
    );
  }

  /**
   * The confirmation dialog of the payment form, worded for one invoice or for
   * the selection: `?ids=` holds the row's own id from its menu, but on the
   * selection bar it is empty or an unresolved row token, which is ignored.
   * The payment date defaults to noon of today, so a date-only field reads the
   * same day in every time zone.
   */
  @Get("mark-paid-confirm")
  markPaidConfirm(
    @MultiParameter("ids") ids: string[],
    @AuthUserWithPermission(invoiceEditAction) _user: User,
  ): ConfirmDialogSerialized {
    const today = new Date(helioNow());
    today.setHours(12, 0, 0, 0);
    const invoiceIds = (ids ?? []).filter((id) => id && !id.includes("{{"));
    const count = Math.max(invoiceIds.length, 1);
    return serializeConfirmDialog({
      params: { count },
      title: "$helio.finance.invoices.markPaid.title",
      description: "$helio.finance.invoices.markPaid.description",
      icon: "i-ph-hand-coins",
      color: "success",
      confirmLabel: "$helio.finance.invoices.markPaid.confirm",
      fields: markPaidFields(today),
    });
  }

  @Post("mark-paid")
  async markPaid(
    @Context() ctx: RequestContext,
    @MultiParameter("ids") ids: string[],
    @JSONBody() body: PaymentInput,
    @AuthUserWithPermission(invoiceEditAction) _user: User,
  ): Promise<ActionResult> {
    const count = await markInvoicesPaid(ids, body ?? {});
    await announceChange(ctx, "paid", count);
    return { count };
  }

  @Post("cancel")
  async cancel(
    @Context() ctx: RequestContext,
    @MultiParameter("ids") ids: string[],
    @AuthUserWithPermission(invoiceEditAction) _user: User,
  ): Promise<ActionResult> {
    const count = await cancelInvoices(ids);
    await announceChange(ctx, "cancelled", count);
    return { count };
  }

  @Post("remind")
  async remind(
    @Context() ctx: RequestContext,
    @MultiParameter("ids") ids: string[],
    @AuthUserWithPermission(invoiceEditAction) _user: User,
  ): Promise<ActionResult> {
    const count = await remindInvoices(ids);
    await announceChange(ctx, "reminded", count);
    return { count };
  }
}

/**
 * Tells the other viewers that invoices changed: the KPI strip and their
 * tables read the invoices again, while the sidebar badge and the overdue
 * banner follow on the next site layout.
 */
async function announceChange(
  ctx: RequestContext,
  type: string,
  count: number,
): Promise<void> {
  await PublishMessage(INVOICES_TOPIC, type, { payload: { count } });
  await NotifyMenuChanged(getRequestTenantId(ctx));
}

QuickAction("helio-new-invoice", {
  category: helioQuickActions,
  displayName: "$helio.finance.quickActions.newInvoice",
  icon: "i-ph-receipt",
  target: {
    type: "openForm",
    page: PageHelioInvoices,
    component: PageHelioInvoices.table,
  },
});

QuickAction("helio-overdue-invoices", {
  category: helioQuickActions,
  displayName: "$helio.finance.quickActions.overdue",
  icon: "i-ph-warning-circle",
  target: {
    type: "navigate",
    page: PageHelioInvoices,
    query: { "table.tab": "overdue" },
  },
});
