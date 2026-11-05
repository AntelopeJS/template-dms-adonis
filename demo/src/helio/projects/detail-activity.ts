import { GetModel } from "@antelopejs/interface-database-decorators";
import type { ActivityFeedItem } from "@antelopejs/interface-dms/base/activity-feed";
import type { Tone } from "@antelopejs/interface-dms/base/types";
import { ActivityModel } from "../dashboard/database";
import type { Activity } from "../dashboard/database";
import type { ProjectBundle } from "./detail-data";
import { recordLink } from "./links";
import { helioNow } from "../shared/clock";

/** The kinds of event in a project's history. */
type MilestoneType =
  | "quote_issued"
  | "quote_sent"
  | "quote_accepted"
  | "project_started"
  | "project_done"
  | "invoice_issued"
  | "invoice_paid"
  | "invoice_overdue";

/** One event of a project's history, before it becomes a feed item. */
interface Milestone {
  type: MilestoneType;
  /** `_id` of the record the event is about. */
  ref: string;
  at: Date;
  number?: string;
  actor?: string;
  amount?: number;
  /** The record's page; none for the project itself, already on screen. */
  link?: string;
}

/**
 * The title, icon and tone of each kind of event, written whole for the i18n
 * check.
 */
const MILESTONE_TEXTS: Record<
  MilestoneType,
  { title: string; icon: string; tone: Tone }
> = {
  quote_issued: {
    title: "$helio.projects.activity.quoteIssued",
    icon: "i-ph-file-text",
    tone: "neutral",
  },
  quote_sent: {
    title: "$helio.projects.activity.quoteSent",
    icon: "i-ph-paper-plane-tilt",
    tone: "info",
  },
  quote_accepted: {
    title: "$helio.projects.activity.quoteAccepted",
    icon: "i-ph-seal-check",
    tone: "success",
  },
  project_started: {
    title: "$helio.projects.activity.projectStarted",
    icon: "i-ph-hard-hat",
    tone: "primary",
  },
  project_done: {
    title: "$helio.projects.activity.projectDone",
    icon: "i-ph-check-circle",
    tone: "success",
  },
  invoice_issued: {
    title: "$helio.projects.activity.invoiceIssued",
    icon: "i-ph-receipt",
    tone: "neutral",
  },
  invoice_paid: {
    title: "$helio.projects.activity.invoicePaid",
    icon: "i-ph-hand-coins",
    tone: "success",
  },
  invoice_overdue: {
    title: "$helio.projects.activity.invoiceOverdue",
    icon: "i-ph-warning-circle",
    tone: "error",
  },
};

/** The statuses of a project that has started on site at some point. */
const STARTED_STATUSES = new Set([
  "in_progress",
  "inspection",
  "done",
  "on_hold",
]);

function quoteMilestones(bundle: ProjectBundle): Milestone[] {
  const { quote } = bundle;
  if (!quote) return [];
  const base = {
    ref: quote._id,
    number: quote.number,
    link: recordLink("quote", quote._id),
  };
  const events: Milestone[] = [
    { ...base, type: "quote_issued", at: quote.issuedAt, amount: quote.total },
  ];
  if (quote.sentAt)
    events.push({ ...base, type: "quote_sent", at: quote.sentAt });
  if (quote.signedAt)
    events.push({ ...base, type: "quote_accepted", at: quote.signedAt });
  return events;
}

function siteMilestones(bundle: ProjectBundle): Milestone[] {
  const { project } = bundle;
  const base = { ref: project._id, actor: project.leadTechnician };
  const events: Milestone[] = [];
  if (STARTED_STATUSES.has(project.status)) {
    events.push({ ...base, type: "project_started", at: project.plannedStart });
  }
  if (project.status === "done") {
    events.push({ ...base, type: "project_done", at: project.plannedEnd });
  }
  return events;
}

function invoiceMilestones(bundle: ProjectBundle): Milestone[] {
  return bundle.invoices.flatMap((invoice) => {
    if (invoice.status === "draft" || invoice.status === "cancelled") return [];
    const base = {
      ref: invoice._id,
      number: invoice.number,
      amount: invoice.total,
      link: recordLink("invoice", invoice._id),
    };
    const events: Milestone[] = [
      { ...base, type: "invoice_issued", at: invoice.issuedAt },
    ];
    if (invoice.paidAt)
      events.push({ ...base, type: "invoice_paid", at: invoice.paidAt });
    if (invoice.status === "overdue") {
      events.push({ ...base, type: "invoice_overdue", at: invoice.dueAt });
    }
    return events;
  });
}

/**
 * The helio_activity rows about this project's records, by `${type}:${ref}`:
 * they lend their actor and date to the matching milestone.
 */
function loggedEvents(
  bundle: ProjectBundle,
  rows: Activity[],
): Map<string, Activity> {
  const refs = [
    bundle.project._id,
    bundle.quote?._id,
    ...bundle.invoices.map((invoice) => invoice._id),
  ].filter((ref): ref is string => Boolean(ref));
  const logged = new Map<string, Activity>();
  for (const row of rows) {
    const ref = refs.find(
      (id) => row.link.endsWith(`/${id}`) || row.link.endsWith(`record=${id}`),
    );
    if (ref) logged.set(`${row.type}:${ref}`, row);
  }
  return logged;
}

function toItem(
  milestone: Milestone,
  bundle: ProjectBundle,
  logged?: Activity,
): ActivityFeedItem {
  const texts = MILESTONE_TEXTS[milestone.type];
  const at = logged?.at ?? milestone.at;
  const actor = bundle.team.get(logged?.actor ?? milestone.actor ?? "");
  const meta: ActivityFeedItem["meta"] = [];
  if (milestone.amount !== undefined) {
    meta.push({
      key: "$helio.projects.activity.amount",
      params: {
        amount: {
          type: "money",
          value: Math.round(milestone.amount * 100),
          currency: "EUR",
        },
      },
    });
  }
  if (actor) {
    meta.push({
      key: "$helio.projects.activity.by",
      params: { name: actor.name },
    });
  }
  return {
    id: `${milestone.type}:${milestone.ref}`,
    icon: texts.icon,
    tone: logged?.tone ?? texts.tone,
    title: texts.title,
    params: { number: milestone.number ?? "" },
    meta,
    date: at.toISOString(),
    to: milestone.link,
  };
}

/**
 * The project's history for its Activity tab, newest first, up to today. It is
 * made of milestones that the project, its quote and its invoices carry
 * themselves (quote sent and signed, start on site, invoices issued and paid),
 * so every project tells its story, not only the recent ones. The matching
 * helio_activity rows, which name who acted, lend their actor and date.
 */
export async function projectActivity(
  bundle: ProjectBundle,
): Promise<{ items: ActivityFeedItem[]; count: number }> {
  const logged = loggedEvents(bundle, await GetModel(ActivityModel).getAll());
  const now = helioNow();
  const items = [
    ...quoteMilestones(bundle),
    ...siteMilestones(bundle),
    ...invoiceMilestones(bundle),
  ]
    .filter((milestone) => milestone.at.getTime() <= now)
    .map((milestone) =>
      toItem(
        milestone,
        bundle,
        logged.get(`${milestone.type}:${milestone.ref}`),
      ),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { items, count: items.length };
}
