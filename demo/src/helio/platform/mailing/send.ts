import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import {
  SendTemplate,
  type SendTemplateResult,
} from "@antelopejs/interface-dms-mailing";
import { CustomerModel } from "../../crm/database";
import type { Invoice } from "../../finance/database";
import type { Project } from "../../projects/database";
import { QuoteModel } from "../../sales/database";
import { type Ticket, TicketModel } from "../../service/database";
import { TeamMemberModel } from "../../team/database";
import {
  type HelioMail,
  installationMail,
  invoiceReminderMail,
  quoteAcceptedMail,
  quoteSentMail,
  ticketReceivedMail,
  ticketResolvedMail,
} from "./mails";

/** "Called from" in the template performance: where in Helio a send starts. */
export const MAIL_SOURCES = {
  quoteSend: "sales.quote-send",
  quoteAccept: "sales.quote-accept",
  invoiceIssued: "finance.invoice-issued",
  invoiceReminder: "finance.invoice-reminder",
  ticketCreated: "service.ticket-created",
  ticketResolved: "service.ticket-resolved",
  overdueReminders: "automation.overdue-reminders",
  installationConfirmations: "automation.installation-confirmations",
} as const;

const SENT_STATUSES = new Set(["queued", "sent", "delivered"]);

/**
 * Sends one e-mail through the Mailing module. Never throws: the outcome is
 * returned when there is one, and a refusal or a provider error is logged. A
 * mail is a side effect of the business action, never its condition: a send
 * that fails (no SMTP account, the Mailing module not loaded, an address on
 * the suppression list) is logged and the action carries on. The domain
 * callers of the `mail*` functions fire them without awaiting.
 */
export async function sendHelioMail(
  mail: HelioMail,
  source: string,
): Promise<SendTemplateResult | undefined> {
  try {
    const result = await SendTemplate(mail.slug, {
      tenantId: DEFAULT_TENANT_ID,
      to: mail.to,
      locale: mail.locale,
      variables: mail.variables,
      source,
    });
    if (!SENT_STATUSES.has(result.status)) {
      Logging.Warn(
        `[helio] mail ${mail.slug} to ${mail.to.email}: ${result.status} ${result.error ?? ""}`,
      );
    }
    return result;
  } catch (error) {
    Logging.Warn(
      `[helio] mail ${mail.slug} to ${mail.to.email} not sent: ${String(error)}`,
    );
    return undefined;
  }
}

/**
 * The customer an e-mail is addressed to. Most callers log a read failure and
 * skip the e-mail; `mailInstallation` lets it propagate to its caller.
 */
async function customerOf(id: string) {
  return GetModel(CustomerModel).get(id);
}

async function teamMember(id: string | undefined) {
  return id ? GetModel(TeamMemberModel).get(id) : undefined;
}

async function quoteMail(
  quoteId: string,
  build: typeof quoteSentMail,
  source: string,
): Promise<void> {
  try {
    const quote = await GetModel(QuoteModel).get(quoteId);
    const customer = quote && (await customerOf(quote.customer));
    if (!quote || !customer) return;
    const rep = await teamMember(customer.owner);
    await sendHelioMail(build(quote, customer, rep), source);
  } catch (error) {
    Logging.Warn(`[helio] quote mail for ${quoteId}: ${String(error)}`);
  }
}

/** "Send to customer": the quote and its portal link. */
export function mailQuoteSent(quoteId: string): Promise<void> {
  return quoteMail(quoteId, quoteSentMail, MAIL_SOURCES.quoteSend);
}

/** "Accept": the thank you and the next steps. */
export function mailQuoteAccepted(quoteId: string): Promise<void> {
  return quoteMail(quoteId, quoteAcceptedMail, MAIL_SOURCES.quoteAccept);
}

/** Payment reminder number `reminderNumber` of an overdue invoice. */
export async function mailInvoiceReminder(
  invoice: Invoice,
  reminderNumber: number,
  source: string = MAIL_SOURCES.invoiceReminder,
): Promise<SendTemplateResult | undefined> {
  try {
    const customer = await customerOf(invoice.customer);
    if (!customer) return undefined;
    const mail = invoiceReminderMail(invoice, customer, reminderNumber);
    return await sendHelioMail(mail, source);
  } catch (error) {
    Logging.Warn(`[helio] reminder for ${invoice.number}: ${String(error)}`);
    return undefined;
  }
}

/**
 * The acknowledgement of a ticket a customer opened. A monitoring alert has
 * no customer request behind it: no acknowledgement.
 */
export async function mailTicketReceived(ticket: Ticket): Promise<void> {
  if (ticket.channel === "monitoring_alert") return;
  try {
    const customer = await customerOf(ticket.customer);
    if (customer) {
      await sendHelioMail(
        ticketReceivedMail(ticket, customer),
        MAIL_SOURCES.ticketCreated,
      );
    }
  } catch (error) {
    Logging.Warn(`[helio] ticket mail for ${ticket.number}: ${String(error)}`);
  }
}

/** The "resolved" notice of each ticket among `ids`, read once resolved. */
export async function mailTicketsResolved(ids: string[]): Promise<void> {
  const model = GetModel(TicketModel);
  for (const id of ids) {
    try {
      const ticket = await model.get(id);
      const customer = ticket && (await customerOf(ticket.customer));
      if (!ticket || !customer) continue;
      await sendHelioMail(
        ticketResolvedMail(ticket, customer),
        MAIL_SOURCES.ticketResolved,
      );
    } catch (error) {
      Logging.Warn(`[helio] resolution mail for ${id}: ${String(error)}`);
    }
  }
}

/** The confirmation of an installation date, to the project's customer. */
export async function mailInstallation(
  project: Project,
): Promise<SendTemplateResult | undefined> {
  const customer = await customerOf(project.customer);
  if (!customer) return undefined;
  const lead = await teamMember(project.leadTechnician);
  return sendHelioMail(
    installationMail(project, customer, lead),
    MAIL_SOURCES.installationConfirmations,
  );
}
