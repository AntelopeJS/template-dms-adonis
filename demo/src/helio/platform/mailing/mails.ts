import type { JsonObject } from "@antelopejs/interface-dms-mailing";
import type { Customer } from "../../crm/database";
import { structuredReference } from "../../finance/document";
import type { Invoice } from "../../finance/database";
import { daysLate } from "../../finance/due";
import type { Project } from "../../projects/database";
import type { Quote } from "../../sales/database";
import { PORTAL_BASE_URL } from "../../sales/links";
import type { Ticket } from "../../service/database";
import type { TeamMember } from "../../team/database";
import {
  customerLocale,
  formatAddress,
  formatDate,
  formatDateTime,
  formatMoney,
  HELIO_TEMPLATES,
  type HelioTemplateSlug,
  type MailLocale,
  portalUrl,
} from "./format";
import { helioNow } from "../../shared/clock";

/**
 * One e-mail to send: the template, who receives it and what it says about a
 * quote, an invoice, a project or a ticket. The live sends and the imported
 * history both build their e-mails in this module, so an old send in the log
 * reads exactly like a new one.
 */
export interface HelioMail {
  slug: HelioTemplateSlug;
  to: { email: string; name: string };
  locale: MailLocale;
  variables: MailVariables;
}

/** The template variables of a mail: JSON, which `SendTemplate` and `ImportSends` both take. */
type MailVariables = JsonObject;

type Person = Pick<TeamMember, "name" | "email" | "phone">;

/** The office, who signs the e-mail when a customer has no account manager. */
const HELIO_DESK: Person = {
  name: "Helio",
  email: "contact@helio.example",
  phone: "+32 4 220 50 50",
};

function mailTo(
  slug: HelioTemplateSlug,
  customer: Customer,
  variables: (locale: MailLocale) => MailVariables,
): HelioMail {
  const locale = customerLocale(customer);
  return {
    slug,
    to: { email: customer.email, name: customer.contactName || customer.name },
    locale,
    variables: {
      customer: { name: customer.contactName || customer.name },
      ...variables(locale),
    },
  };
}

const salesRep = (rep: Person | undefined) => ({
  name: (rep ?? HELIO_DESK).name,
  email: (rep ?? HELIO_DESK).email,
});

/** The link of the portal the customer signs the quote on. */
export function quotePortalUrl(quote: Pick<Quote, "number" | "portalToken">) {
  return `${PORTAL_BASE_URL}/${encodeURIComponent(quote.number)}?t=${quote.portalToken}`;
}

export function quoteSentMail(
  quote: Quote,
  customer: Customer,
  rep: Person | undefined,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.quoteSent, customer, (locale) => ({
    quote: {
      number: quote.number,
      total: formatMoney(quote.total, locale),
      validUntil: formatDate(quote.validUntil, locale),
      url: quotePortalUrl(quote),
    },
    salesRep: salesRep(rep),
  }));
}

export function quoteAcceptedMail(
  quote: Quote,
  customer: Customer,
  rep: Person | undefined,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.quoteAccepted, customer, (locale) => ({
    quote: { number: quote.number, total: formatMoney(quote.total, locale) },
    salesRep: salesRep(rep),
  }));
}

export function installationMail(
  project: Project,
  customer: Customer,
  lead: Person | undefined,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.installationScheduled, customer, (locale) => ({
    project: {
      code: project.code,
      name: project.name,
      startDate: formatDate(project.plannedStart, locale),
      address: formatAddress(project.address ?? customer.address),
    },
    lead: {
      name: (lead ?? HELIO_DESK).name,
      phone: (lead ?? HELIO_DESK).phone,
    },
  }));
}

export function invoiceIssuedMail(
  invoice: Invoice,
  customer: Customer,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.invoiceIssued, customer, (locale) => ({
    invoice: {
      number: invoice.number,
      total: formatMoney(invoice.total, locale),
      dueAt: formatDate(invoice.dueAt, locale),
      reference: structuredReference(invoice.number),
      url: portalUrl("factures", invoice.number),
    },
  }));
}

/**
 * The reminder number `reminderNumber`, as written on `at`. Days overdue are
 * calendar days, as the invoice list counts them (`finance/due.ts`), and at
 * least 1.
 */
export function invoiceReminderMail(
  invoice: Invoice,
  customer: Customer,
  reminderNumber: number,
  at: Date = new Date(helioNow()),
): HelioMail {
  const daysOverdue = Math.max(1, daysLate(invoice.dueAt, at.getTime()));
  return mailTo(HELIO_TEMPLATES.invoiceReminder, customer, (locale) => ({
    invoice: {
      number: invoice.number,
      amountDue: formatMoney(invoice.amountDue || invoice.total, locale),
      dueAt: formatDate(invoice.dueAt, locale),
      daysOverdue,
      reminderNumber,
      reference: structuredReference(invoice.number),
      url: portalUrl("factures", invoice.number),
    },
  }));
}

export function ticketReceivedMail(
  ticket: Ticket,
  customer: Customer,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.ticketReceived, customer, (locale) => ({
    ticket: {
      number: ticket.number,
      subject: ticket.subject,
      responseBy: formatDateTime(ticket.slaDueAt, locale),
      url: portalUrl("tickets", ticket.number),
    },
  }));
}

export function ticketResolvedMail(
  ticket: Ticket,
  customer: Customer,
): HelioMail {
  return mailTo(HELIO_TEMPLATES.ticketResolved, customer, (locale) => ({
    ticket: {
      number: ticket.number,
      subject: ticket.subject,
      resolvedAt: formatDate(ticket.resolvedAt ?? new Date(helioNow()), locale),
      url: portalUrl("tickets", ticket.number),
    },
  }));
}
