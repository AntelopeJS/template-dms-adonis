import type { ActionType } from "@antelopejs/interface-dms-automation";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { CustomerModel, DealModel } from "../../crm/database";
import { type Invoice, InvoiceModel } from "../../finance/database";
import { daysLate } from "../../finance/due";
import { INVOICES_TOPIC } from "../../finance/table";
import { PROJECT_PAGE_URL } from "../../projects/links";
import {
  type Project,
  ProjectModel,
  ProjectTaskModel,
} from "../../projects/database";
import { QuoteModel } from "../../sales/database";
import { QUOTES_PAGE_URL } from "../../sales/links";
import { currentSettings } from "../../settings/current";
import type { ReminderStep } from "../../settings/types";
import { DAY_MS } from "../../shared/seed";
import {
  mailInstallation,
  mailInvoiceReminder,
  MAIL_SOURCES,
  noticedRecords,
  recordNotice,
} from "../mailing";
import { helioNow } from "../../shared/clock";

const SENT = new Set(["queued", "sent", "delivered"]);

const money = (amount: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    amount,
  );

interface ReminderInput {
  minDaysOverdue?: number;
  minDaysBetween?: number;
}

/**
 * The reminder an overdue invoice is due for, from the schedule of the
 * Settings page (Finance › Collections): its next step once the invoice is
 * late by that step's days, nothing once every step was sent. Without a
 * schedule, an e-mail once it is `minDaysOverdue` late. Never two reminders
 * within `minDaysBetween` days.
 */
function dueReminder(
  invoice: Invoice,
  input: ReminderInput,
  schedule: readonly ReminderStep[],
): Pick<ReminderStep, "channel"> | undefined {
  if (invoice.status !== "overdue") return undefined;
  const sinceLast = invoice.remindedAt
    ? (helioNow() - invoice.remindedAt.getTime()) / DAY_MS
    : Number.POSITIVE_INFINITY;
  if (sinceLast < (input.minDaysBetween ?? 7)) return undefined;
  const late = daysLate(invoice.dueAt);
  if (schedule.length === 0) {
    return late >= (input.minDaysOverdue ?? 14)
      ? { channel: "email" }
      : undefined;
  }
  const step = schedule[invoice.reminderCount ?? 0];
  return step && late >= step.afterDays ? step : undefined;
}

/** Stamps a sent reminder on the invoice and returns its sequence number (1 for the first). */
async function stampReminder(invoice: Invoice): Promise<number> {
  const reminderCount = (invoice.reminderCount ?? 0) + 1;
  await GetModel(InvoiceModel).update(invoice._id, {
    remindedAt: new Date(helioNow()),
    reminderCount,
  });
  return reminderCount;
}

/** What the overdue-invoice reminder reports to the run. */
type ReminderOutput = {
  reminded: number;
  amountDue: number;
  summary: string;
};

/** What the kick-off planning reports: where the kick-off went. */
type KickoffOutput = {
  target: "project" | "deal";
  summary: string;
  link: string;
};

/** What the installation confirmations report. */
type ConfirmationOutput = {
  confirmed: number;
  summary: string;
};

/**
 * Sends the due reminder of each overdue invoice. A step whose channel is not
 * e-mail, such as a registered letter, is posted by the office: the step is
 * recorded on the invoice but nothing is e-mailed.
 */
const remindOverdueInvoices: ActionType<ReminderInput, ReminderOutput> = {
  id: "helio.remind-overdue-invoices",
  name: "$helio.platform.automation.actions.remindOverdue.name",
  description: "$helio.platform.automation.actions.remindOverdue.description",
  icon: "i-ph-envelope-simple-open",
  inputSchema: {
    type: "object",
    properties: {
      minDaysOverdue: {
        type: "number",
        title:
          "$helio.platform.automation.actions.remindOverdue.minDaysOverdue",
        default: 14,
      },
      minDaysBetween: {
        type: "number",
        title:
          "$helio.platform.automation.actions.remindOverdue.minDaysBetween",
        default: 7,
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      reminded: {
        type: "number",
        title: "$helio.platform.automation.fields.reminded",
      },
      amountDue: {
        type: "number",
        title: "$helio.platform.automation.fields.amountDue",
      },
      summary: {
        type: "string",
        title: "$helio.platform.automation.fields.summary",
      },
    },
  },
  async execute(input, ctx) {
    const [overdue, settings] = await Promise.all([
      GetModel(InvoiceModel).getBy("status", "overdue"),
      currentSettings(),
    ]);
    const schedule = [...(settings.reminders ?? [])].sort(
      (a, b) => a.afterDays - b.afterDays,
    );
    const due = overdue.flatMap((invoice) => {
      const step = dueReminder(invoice, input, schedule);
      return step ? [{ invoice, step }] : [];
    });
    let sent = 0;
    for (const { invoice, step } of due) {
      const reminderNumber = await stampReminder(invoice);
      if (step.channel !== "email") {
        ctx.log("info", `${invoice.number}: ${step.channel} to send`);
        continue;
      }
      const result = await mailInvoiceReminder(
        invoice,
        reminderNumber,
        MAIL_SOURCES.overdueReminders,
      );
      if (result && SENT.has(result.status)) sent += 1;
      else ctx.log("warn", `reminder for ${invoice.number} not delivered`);
    }
    if (due.length > 0) {
      await PublishMessage(INVOICES_TOPIC, "reminded", {
        payload: { count: due.length },
      });
    }
    const amountDue = due.reduce(
      (sum, { invoice }) => sum + invoice.amountDue,
      0,
    );
    ctx.log("info", `${due.length} reminder(s), ${sent} e-mailed`);
    return {
      reminded: due.length,
      amountDue,
      summary: `${due.map(({ invoice }) => invoice.number).join(", ")} · ${money(amountDue)}`,
    };
  },
};

/** Adds a kick-off call task to the project born from the quote, unless it already has one. */
async function kickoffTask(project: Project, quoteNumber: string) {
  const tasks = GetModel(ProjectTaskModel);
  const existing = await tasks.getBy("project", project._id);
  const _id = `kickoff-${project._id}`;
  if (existing.some((task) => task._id === _id)) return;
  await tasks.insert({
    _id,
    project: project._id,
    title: `Appel de lancement avec le client (devis ${quoteNumber})`,
    status: "todo",
    assignee: project.leadTechnician,
    dueDate: new Date(helioNow() + 3 * DAY_MS),
    estimateHours: 1,
    position: Math.max(0, ...existing.map(({ position }) => position)) + 1000,
  });
}

/**
 * Prepares the kick-off of a signed quote: a task on its project, or, while
 * the quote has no project yet, a kick-off next step on its deal. That step is
 * worded in each reader's language by the deals' `nextStepLine` until one is
 * typed again.
 */
const planKickoff: ActionType<{ quoteId?: string }, KickoffOutput> = {
  id: "helio.plan-kickoff",
  name: "$helio.platform.automation.actions.planKickoff.name",
  description: "$helio.platform.automation.actions.planKickoff.description",
  icon: "i-ph-flag-banner",
  inputSchema: {
    type: "object",
    properties: {
      quoteId: {
        type: "string",
        title: "$helio.platform.automation.fields.quoteId",
      },
    },
    required: ["quoteId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      target: {
        type: "string",
        title: "$helio.platform.automation.fields.target",
        enum: ["project", "deal"],
      },
      summary: {
        type: "string",
        title: "$helio.platform.automation.fields.summary",
      },
      link: { type: "string", title: "$helio.platform.automation.fields.link" },
    },
  },
  async execute(input, ctx) {
    const quote = input.quoteId
      ? await GetModel(QuoteModel).get(input.quoteId)
      : undefined;
    if (!quote) throw new Error(`unknown quote "${input.quoteId ?? ""}"`);
    const customer = await GetModel(CustomerModel).get(quote.customer);
    const [project] = await GetModel(ProjectModel).getBy("quote", quote._id);
    const who = `${quote.number} · ${customer?.name ?? ""}`;
    if (project) {
      await kickoffTask(project, quote.number);
      ctx.log("info", `kick-off task added to ${project.code}`);
      return {
        target: "project",
        summary: `${who} · ${project.code}`,
        link: `${PROJECT_PAGE_URL}/${project._id}`,
      };
    }
    if (quote.deal) {
      await GetModel(DealModel).update(quote.deal, {
        kickoffQuote: quote.number,
        lastActivityAt: new Date(helioNow()),
      });
    }
    ctx.log("info", "no project yet: the deal carries the kick-off");
    return {
      target: "deal",
      summary: who,
      link: `${QUOTES_PAGE_URL}?record=${quote._id}`,
    };
  },
};

/** Scheduled projects starting within `daysAhead` days whose customer was not yet sent an installation notice. */
async function projectsToConfirm(daysAhead: number): Promise<Project[]> {
  const [scheduled, noticed] = await Promise.all([
    GetModel(ProjectModel).getBy("status", "scheduled"),
    noticedRecords("installation"),
  ]);
  const now = helioNow();
  return scheduled.filter(
    (project) =>
      !noticed.has(project._id) &&
      project.plannedStart.getTime() > now &&
      project.plannedStart.getTime() <= now + daysAhead * DAY_MS,
  );
}

const confirmInstallations: ActionType<
  { daysAhead?: number },
  ConfirmationOutput
> = {
  id: "helio.confirm-installations",
  name: "$helio.platform.automation.actions.confirmInstallations.name",
  description:
    "$helio.platform.automation.actions.confirmInstallations.description",
  icon: "i-ph-calendar-check",
  inputSchema: {
    type: "object",
    properties: {
      daysAhead: {
        type: "number",
        title:
          "$helio.platform.automation.actions.confirmInstallations.daysAhead",
        default: 14,
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      confirmed: {
        type: "number",
        title: "$helio.platform.automation.fields.confirmed",
      },
      summary: {
        type: "string",
        title: "$helio.platform.automation.fields.summary",
      },
    },
  },
  async execute(input, ctx) {
    const projects = await projectsToConfirm(input.daysAhead ?? 14);
    const confirmed: string[] = [];
    for (const project of projects) {
      const result = await mailInstallation(project);
      if (result && SENT.has(result.status)) {
        await recordNotice("installation", project._id, new Date(helioNow()));
        confirmed.push(project.code);
      } else {
        ctx.log("warn", `confirmation for ${project.code} not sent`);
      }
    }
    ctx.log("info", `${confirmed.length} installation date(s) confirmed`);
    return {
      confirmed: confirmed.length,
      summary: confirmed.join(", ") || "—",
    };
  },
};

/**
 * Helio's actions about money and planning: remind customers of long-overdue
 * invoices, prepare the kick-off of a signed quote, and confirm the coming
 * installation dates to their customers.
 */
export const businessActionTypes = [
  remindOverdueInvoices,
  planKickoff,
  confirmInstallations,
];
