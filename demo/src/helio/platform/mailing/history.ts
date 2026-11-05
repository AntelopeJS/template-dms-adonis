import {
  type ImportedSend,
  type ImportedSendEvent,
  ImportSends,
  RecordEmailEvent,
} from "@antelopejs/interface-dms-mailing";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { type Customer, CustomerModel } from "../../crm/database";
import { InvoiceModel } from "../../finance/database";
import { ProjectModel } from "../../projects/database";
import { QuoteModel } from "../../sales/database";
import { TicketModel } from "../../service/database";
import { DAY_MS } from "../../shared/seed";
import { TeamMemberModel } from "../../team/database";
import type { HelioTemplateSlug } from "./format";
import { type Engagement, historyEvents } from "./history-events";
import {
  type HelioMail,
  installationMail,
  invoiceIssuedMail,
  invoiceReminderMail,
  quoteAcceptedMail,
  quoteSentMail,
  ticketReceivedMail,
  ticketResolvedMail,
} from "./mails";
import { MAIL_SOURCES } from "./send";
import { helioNow } from "../../shared/clock";

const WINDOW_DAYS = 45;
const MINUTE_MS = 60 * 1000;
/** Installation dates are confirmed nine days ahead (the weekly run's rhythm). */
export const CONFIRMATION_LEAD_DAYS = 9;
/** An unpaid invoice gets its first reminder a week after its due date. */
const FIRST_REMINDER_DAYS = 7;
const SIMULATED_TICKET = "ticket-sim-";
const PROVIDER = "smtp";
/** The provider events dms-mailing may suppress an address for. */
const REPORTED_EVENTS = new Set<ImportedSendEvent["type"]>(["bounced", "spam"]);

const ENGAGEMENT: Record<HelioTemplateSlug, Engagement> = {
  "helio-quote-sent": { openRate: 0.82, clickRate: 0.55 },
  "helio-quote-accepted": { openRate: 0.74, clickRate: 0 },
  "helio-installation-scheduled": { openRate: 0.88, clickRate: 0 },
  "helio-invoice-issued": { openRate: 0.69, clickRate: 0.38 },
  "helio-invoice-reminder": { openRate: 0.61, clickRate: 0.29 },
  "helio-ticket-received": { openRate: 0.57, clickRate: 0.18 },
  "helio-ticket-resolved": { openRate: 0.64, clickRate: 0.12 },
};

interface HistoryEntry {
  importId: string;
  sentAt: Date;
  mail: HelioMail;
  source: string;
}

/** A send of the history, with what happened to it. */
function toImportedSend(entry: HistoryEntry): ImportedSend {
  const { importId, sentAt, mail, source } = entry;
  return {
    importId,
    templateSlug: mail.slug,
    to: mail.to,
    sentAt,
    locale: mail.locale,
    variables: mail.variables,
    provider: PROVIDER,
    providerMessageId: `<${importId}@mail.helio.example>`,
    source,
    events: historyEvents(
      importId,
      mail.to.email,
      sentAt,
      ENGAGEMENT[mail.slug],
    ),
  };
}

/**
 * Reports the bounces and complaints held back from the import. Each keeps
 * its date and details, so a boot that finds it recorded already skips it.
 *
 * @returns How many events were recorded
 */
async function reportProblems(sends: ImportedSend[]): Promise<number> {
  let recorded = 0;
  for (const send of sends) {
    for (const event of send.events ?? []) {
      if (!REPORTED_EVENTS.has(event.type) || !send.providerMessageId) continue;
      const isRecorded = await RecordEmailEvent(DEFAULT_TENANT_ID, {
        provider: PROVIDER,
        messageId: send.providerMessageId,
        type: event.type,
        at: event.at,
        details: event.details,
      });
      if (isRecorded) recorded++;
    }
  }
  return recorded;
}

const inWindow = (date: Date | undefined, now: number): date is Date =>
  !!date &&
  date.getTime() <= now - MINUTE_MS &&
  date.getTime() >= now - WINDOW_DAYS * DAY_MS;

const later = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * MINUTE_MS);

/** The quote e-mails: each quote sent and each quote signed within the window. */
async function salesHistory(
  customers: Map<string, Customer>,
  now: number,
): Promise<HistoryEntry[]> {
  const [quotes, team] = await Promise.all([
    GetModel(QuoteModel).getAll(),
    GetModel(TeamMemberModel).getAll(),
  ]);
  const members = new Map(team.map((member) => [member._id, member]));
  return quotes.flatMap((quote) => {
    const customer = customers.get(quote.customer);
    if (!customer) return [];
    const rep = customer.owner ? members.get(customer.owner) : undefined;
    const entries: HistoryEntry[] = [];
    if (inWindow(quote.sentAt, now)) {
      entries.push({
        importId: `helio:quote-sent:${quote._id}`,
        sentAt: later(quote.sentAt, 2),
        mail: quoteSentMail(quote, customer, rep),
        source: MAIL_SOURCES.quoteSend,
      });
    }
    if (inWindow(quote.signedAt, now)) {
      entries.push({
        importId: `helio:quote-accepted:${quote._id}`,
        sentAt: later(quote.signedAt, 1),
        mail: quoteAcceptedMail(quote, customer, rep),
        source: MAIL_SOURCES.quoteAccept,
      });
    }
    return entries;
  });
}

/**
 * The installation dates already confirmed: a confirmation went out nine days
 * before each start that is far enough in the past.
 */
async function installationHistory(
  customers: Map<string, Customer>,
  now: number,
): Promise<Array<HistoryEntry & { projectId: string }>> {
  const [projects, team] = await Promise.all([
    GetModel(ProjectModel).getAll(),
    GetModel(TeamMemberModel).getAll(),
  ]);
  const members = new Map(team.map((member) => [member._id, member]));
  return projects.flatMap((project) => {
    const customer = customers.get(project.customer);
    const confirmedAt = new Date(
      project.plannedStart.getTime() - CONFIRMATION_LEAD_DAYS * DAY_MS,
    );
    confirmedAt.setHours(14, 0, 0, 0);
    if (
      !customer ||
      project.status === "on_hold" ||
      !inWindow(confirmedAt, now - 2 * DAY_MS)
    ) {
      return [];
    }
    const lead = project.leadTechnician
      ? members.get(project.leadTechnician)
      : undefined;
    return [
      {
        projectId: project._id,
        importId: `helio:installation:${project._id}`,
        sentAt: confirmedAt,
        mail: installationMail(project, customer, lead),
        source: MAIL_SOURCES.installationConfirmations,
      },
    ];
  });
}

/**
 * The invoice e-mails: each issued invoice, and a first reminder a week after
 * the due date for those paid later than that or still unpaid.
 */
async function billingHistory(
  customers: Map<string, Customer>,
  now: number,
): Promise<HistoryEntry[]> {
  const invoices = await GetModel(InvoiceModel).getAll();
  return invoices.flatMap((invoice) => {
    const customer = customers.get(invoice.customer);
    if (!customer || invoice.status === "draft") return [];
    const entries: HistoryEntry[] = [];
    if (inWindow(invoice.issuedAt, now)) {
      entries.push({
        importId: `helio:invoice-issued:${invoice._id}`,
        sentAt: later(invoice.issuedAt, 95),
        mail: invoiceIssuedMail(invoice, customer),
        source: MAIL_SOURCES.invoiceIssued,
      });
    }
    const remindedAt = later(invoice.dueAt, FIRST_REMINDER_DAYS * 24 * 60);
    const paidAfter = !invoice.paidAt || invoice.paidAt > remindedAt;
    if (
      invoice.status !== "cancelled" &&
      paidAfter &&
      inWindow(remindedAt, now)
    ) {
      entries.push({
        importId: `helio:invoice-reminder:${invoice._id}:1`,
        sentAt: remindedAt,
        mail: invoiceReminderMail(invoice, customer, 1, remindedAt),
        source: MAIL_SOURCES.invoiceReminder,
      });
    }
    return entries;
  });
}

/**
 * The ticket e-mails: receipt and resolution. Monitoring alerts open tickets
 * with no customer e-mail behind them, and the simulated tickets come and go,
 * so both stay out of the history.
 */
async function serviceHistory(
  customers: Map<string, Customer>,
  now: number,
): Promise<HistoryEntry[]> {
  const tickets = await GetModel(TicketModel).getAll();
  return tickets.flatMap((ticket) => {
    const customer = customers.get(ticket.customer);
    if (!customer || ticket._id.startsWith(SIMULATED_TICKET)) return [];
    const entries: HistoryEntry[] = [];
    if (
      ticket.channel !== "monitoring_alert" &&
      inWindow(ticket.createdAt, now)
    ) {
      entries.push({
        importId: `helio:ticket-received:${ticket._id}`,
        sentAt: later(ticket.createdAt, 1),
        mail: ticketReceivedMail(ticket, customer),
        source: MAIL_SOURCES.ticketCreated,
      });
    }
    if (inWindow(ticket.resolvedAt, now)) {
      entries.push({
        importId: `helio:ticket-resolved:${ticket._id}`,
        sentAt: later(ticket.resolvedAt, 3),
        mail: ticketResolvedMail(ticket, customer),
        source: MAIL_SOURCES.ticketResolved,
      });
    }
    return entries;
  });
}

/** What an import of the send history did. */
export interface HistoryImport {
  imported: number;
  skipped: number;
  /** Bounces and complaints reported after the import (see `importMailHistory`). */
  reported: number;
  /** Projects whose installation date the history already confirmed. */
  confirmedProjects: Array<{ projectId: string; sentAt: Date }>;
}

/**
 * Imports the e-mails Helio sent over the last weeks, rebuilt from the
 * business data itself: every quote sent or signed, installation confirmed,
 * invoice issued or reminded and ticket opened or resolved in the window has
 * its e-mail, at the date the record says. It is idempotent: each send has a
 * stable `importId`, so known sends are skipped and the Mailing overview shows
 * a living send log from the first boot.
 *
 * An import delivers nothing, so dms-mailing puts no address on its
 * suppression list from one. The bounces and spam complaints of the history
 * are therefore left out of the import and reported right after, as the
 * provider's webhook would, through `RecordEmailEvent`: dms-mailing then
 * suppresses the hard-bounced and complaining addresses itself, and later
 * sends to them are held back.
 */
export async function importMailHistory(): Promise<HistoryImport> {
  const now = helioNow();
  const customers = new Map(
    (await GetModel(CustomerModel).getAll()).map((row) => [row._id, row]),
  );
  const installations = await installationHistory(customers, now);
  const entries = [
    ...(await salesHistory(customers, now)),
    ...installations,
    ...(await billingHistory(customers, now)),
    ...(await serviceHistory(customers, now)),
  ].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const sends = entries.map(toImportedSend);
  const result = await ImportSends({
    tenantId: DEFAULT_TENANT_ID,
    sends: sends.map((send) => ({
      ...send,
      events: send.events?.filter(({ type }) => !REPORTED_EVENTS.has(type)),
    })),
  });
  return {
    imported: result.imported,
    skipped: result.skipped,
    reported: await reportProblems(sends),
    confirmedProjects: installations.map(({ projectId, sentAt }) => ({
      projectId,
      sentAt,
    })),
  };
}
