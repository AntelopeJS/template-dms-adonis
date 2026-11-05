import {
  Controller,
  Get,
  HTTPResult,
  JSONBody,
  Parameter,
  Post,
} from "@antelopejs/interface-api";
import { GetModel } from "@antelopejs/interface-database-decorators";
import type { User } from "@antelopejs/interface-dms/auth/db";
import type { Action } from "@antelopejs/interface-dms/component";
import {
  type ConfirmDialogSerialized,
  serializeConfirmDialog,
} from "@antelopejs/interface-dms/base/table-view";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import { CustomerModel, DealModel } from "../crm/database";
import { fireQuoteAccepted } from "../platform/automation/events";
import { mailQuoteAccepted, mailQuoteSent } from "../platform/mailing/send";
import { readCompanyIdentity } from "../settings/company";
import { DAY_MS } from "../shared/seed";
import { type Quote, QuoteModel, type QuoteStatus } from "./database";
import { renderQuoteDocument } from "./document";
import { quoteAccepted, quoteSent } from "./lifecycle";
import { documentLanguage } from "./document-texts";
import { PORTAL_BASE_URL, QUOTE_ACTIONS_API } from "./links";
import { VALIDITY_DAYS } from "./options";
import { PageHelioQuotes } from "./page";
import { helioNow } from "../shared/clock";

interface RejectBody {
  reason?: string;
}

/**
 * An action of the quotes table, whose permissions guard these routes: reading
 * a quote (its document, its link) takes `list`, moving it along its life cycle
 * takes `edit`.
 */
function tableAction(id: string): Action {
  const action = PageHelioQuotes.table.getAction(id);
  if (!action) throw new Error(`The quotes table has no '${id}' action`);
  return action;
}
const canRead = tableAction("list");
const canEdit = tableAction("edit");

function refuse(status: number, message: string): HTTPResult {
  return new HTTPResult(status, { message });
}

async function findQuote(id: string): Promise<Quote> {
  const quote = await GetModel(QuoteModel).get(id);
  if (!quote) throw refuse(404, "$helio.sales.quotes.errors.notFound");
  return quote;
}

/**
 * What a status change says when the quote no longer stands in the status it
 * needs: a stale table (another user just sent it) gets a clear message.
 */
const NOT_IN_STATUS: Partial<Record<QuoteStatus, string>> = {
  draft: "$helio.sales.quotes.errors.notDraft",
  sent: "$helio.sales.quotes.errors.notSent",
};

async function quoteIn(id: string, status: QuoteStatus): Promise<Quote> {
  const quote = await findQuote(id);
  if (quote.status !== status) {
    throw refuse(
      409,
      NOT_IN_STATUS[status] ?? "$helio.sales.quotes.errors.notSent",
    );
  }
  return quote;
}

/** The row actions of the quotes table that no data route covers. */
export class HelioQuoteRoutes extends Controller(QUOTE_ACTIONS_API) {
  /**
   * The "Send to customer" dialog, worded for the quote: who receives it,
   * where, and what changes once it is sent. A quote that is no longer a draft
   * gets a blocked dialog.
   */
  @Get("send-confirm")
  async sendConfirm(
    @Parameter("id", "query") id: string,
    @AuthUserWithPermission(canEdit) _user: User,
  ): Promise<ConfirmDialogSerialized> {
    const quote = await findQuote(id);
    if (quote.status !== "draft") {
      return serializeConfirmDialog({
        title: "$helio.sales.quotes.send.blockedTitle",
        description: "$helio.sales.quotes.send.blockedDescription",
        params: { number: quote.number },
        icon: "i-ph-lock-simple",
        color: "warning",
        blocked: true,
      });
    }
    const customer = await GetModel(CustomerModel).get(quote.customer);
    return serializeConfirmDialog({
      title: "$helio.sales.quotes.send.title",
      description: "$helio.sales.quotes.send.description",
      params: {
        number: quote.number,
        customer: customer?.name ?? "—",
        email: customer?.email ?? "—",
      },
      icon: "i-ph-paper-plane-tilt",
      color: "primary",
      confirmLabel: "$helio.sales.quotes.send.confirm",
      impact: [
        {
          icon: "i-ph-envelope-simple",
          label: "$helio.sales.quotes.send.impactEmail",
        },
        {
          icon: "i-ph-list-numbers",
          label: "$helio.sales.quotes.send.impactLines",
          count: quote.lines?.length ?? 0,
        },
        {
          icon: "i-ph-signature",
          label: "$helio.sales.quotes.send.impactPortal",
        },
        {
          icon: "i-ph-lock-simple",
          label: "$helio.sales.quotes.send.impactLocked",
        },
      ],
    });
  }

  /**
   * A draft goes out: sent now, and valid for VALIDITY_DAYS more if its
   * validity ran out while it waited. The customer is then e-mailed the quote
   * and its portal link (Helio platform, mailing) without the route waiting for
   * it; a failed e-mail is logged and the quote stays sent.
   */
  @Post("send")
  async send(
    @Parameter("id", "query") id: string,
    @AuthUserWithPermission(canEdit) _user: User,
  ): Promise<{ ok: true }> {
    const quote = await quoteIn(id, "draft");
    const now = new Date(helioNow());
    const validUntil =
      quote.validUntil && quote.validUntil > now
        ? quote.validUntil
        : new Date(now.getTime() + VALIDITY_DAYS * DAY_MS);
    await GetModel(QuoteModel).update(id, {
      status: "sent",
      sentAt: now,
      validUntil,
    });
    void mailQuoteSent(id);
    await quoteSent(quote);
    return { ok: true };
  }

  /**
   * A sent quote the customer signed. Its deal is won at the quote's subtotal
   * and the activity feed logs it (see `quoteAccepted`). The thank-you e-mail
   * and the "Quote accepted" automation trigger (kick-off procedure) are fired
   * without the route waiting for them, and neither can fail the accept.
   */
  @Post("accept")
  async accept(
    @Parameter("id", "query") id: string,
    @AuthUserWithPermission(canEdit) _user: User,
  ): Promise<{ ok: true }> {
    const quote = await quoteIn(id, "sent");
    await GetModel(QuoteModel).update(id, {
      status: "accepted",
      signedAt: new Date(helioNow()),
    });
    await quoteAccepted(quote);
    void mailQuoteAccepted(id);
    fireQuoteAccepted(quote);
    return { ok: true };
  }

  /**
   * A sent quote the customer turned down. The reason, when given, is kept in a
   * field of its own: the notes stay the team's, and no wording is stored in
   * one language.
   */
  @Post("reject")
  async reject(
    @Parameter("id", "query") id: string,
    @JSONBody() body: RejectBody | undefined,
    @AuthUserWithPermission(canEdit) _user: User,
  ): Promise<{ ok: true }> {
    await quoteIn(id, "sent");
    const reason = body?.reason?.trim();
    const update: Partial<Quote> = { status: "rejected" };
    if (reason) update.rejectionReason = reason;
    await GetModel(QuoteModel).update(id, update);
    return { ok: true };
  }

  /**
   * The link the customer opens the quote with (copied by the action). A draft,
   * or a quote without a token, is refused with a 409.
   */
  @Post("portal-link")
  async portalLink(
    @Parameter("id", "query") id: string,
    @AuthUserWithPermission(canRead) _user: User,
  ): Promise<{ url: string }> {
    const quote = await findQuote(id);
    if (quote.status === "draft" || !quote.portalToken) {
      throw refuse(409, "$helio.sales.quotes.errors.noPortalLink");
    }
    return {
      url: `${PORTAL_BASE_URL}/${encodeURIComponent(quote.number)}?t=${quote.portalToken}`,
    };
  }

  /** The quote as a PDF, in the reader's language. */
  @Get("document")
  async document(
    @Parameter("id", "query") id: string,
    @Parameter("accept-language", "header") acceptLanguage: string | undefined,
    @AuthUserWithPermission(canRead) _user: User,
  ): Promise<HTTPResult> {
    const quote = await findQuote(id);
    const [customer, deal] = await Promise.all([
      GetModel(CustomerModel).get(quote.customer),
      quote.deal ? GetModel(DealModel).get(quote.deal) : undefined,
    ]);
    const pdf = renderQuoteDocument({
      company: await readCompanyIdentity(),
      quote,
      customer,
      dealTitle: deal?.title,
      language: documentLanguage(acceptLanguage),
    });
    return HTTPResult.withHeaders(new HTTPResult(200, pdf, "application/pdf"), {
      "Content-Disposition": `attachment; filename="${quote.number}.pdf"`,
    });
  }
}
