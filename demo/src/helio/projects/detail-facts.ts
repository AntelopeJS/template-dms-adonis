import type { BannerContent } from "@antelopejs/interface-dms/base/banner";
import type { KeyValueListItem } from "@antelopejs/interface-dms/base/key-value-list";
import type { MeterSegment } from "@antelopejs/interface-dms/base/meter";
import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type { Tone } from "@antelopejs/interface-dms/base/types";
import type { TeamMember } from "../team/database";
import {
  addressLine,
  countTasks,
  invoiceTotals,
  isLate,
  type ProjectBundle,
} from "./detail-data";
import type { Project, ProjectStatus } from "./database";
import { directionsUrl, projectPageUrl, recordLink } from "./links";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./project-controller";

/** The tone each project status is shown in. */
const STATUS_TONES: Record<ProjectStatus, Tone> = {
  planned: "neutral",
  scheduled: "info",
  in_progress: "primary",
  inspection: "secondary",
  done: "success",
  on_hold: "warning",
};

const day = (date: Date) =>
  ({ type: "date", value: date.toISOString(), format: "medium" }) as const;

const count = (value: number) => ({ type: "count", value }) as const;

export function statusLabel(status: string): string {
  return PROJECT_STATUSES.find((item) => item.value === status)?.label ?? "";
}

function typeLabel(type: string): string {
  return PROJECT_TYPES.find((item) => item.value === type)?.label ?? "";
}

function memberItem(
  id: string | undefined,
  team: Map<string, TeamMember>,
): Pick<KeyValueListItem, "value" | "to" | "type" | "detail"> {
  const member = id ? team.get(id) : undefined;
  if (!member) return { value: "$helio.projects.detail.facts.unassigned" };
  return {
    value: member.name,
    type: "link",
    to: recordLink("member", member._id),
    detail: member.phone,
  };
}

function crewNames(project: Project, team: Map<string, TeamMember>): string {
  return (project.crew ?? [])
    .map((id) => team.get(id)?.name)
    .filter(Boolean)
    .join(", ");
}

/**
 * The project's facts: who, what, where, when, for how much. A battery or a
 * charger has no peak power, so its capacity is a dash, not "0 kWp".
 */
export function projectFacts(bundle: ProjectBundle): KeyValueListItem[] {
  const { project, customer, quote, team } = bundle;
  const address = addressLine(project);
  return [
    {
      id: "code",
      label: "$helio.projects.columns.code",
      value: project.code,
      type: "mono",
      copy: true,
    },
    {
      id: "customer",
      label: "$helio.projects.columns.customer",
      value: customer?.name ?? null,
      type: "link",
      to: recordLink("customer", project.customer),
      detail: customer?.isVip ? "$helio.projects.detail.facts.vip" : undefined,
    },
    {
      id: "quote",
      label: "$helio.projects.columns.quote",
      value: quote?.number ?? null,
      type: quote ? "link" : "text",
      to: quote ? recordLink("quote", quote._id) : undefined,
      copy: Boolean(quote),
    },
    {
      id: "type",
      label: "$helio.projects.columns.type",
      value: typeLabel(project.type),
    },
    {
      id: "status",
      label: "$helio.projects.columns.status",
      value: statusLabel(project.status),
      type: "status",
      tone: STATUS_TONES[project.status],
    },
    {
      id: "lead",
      label: "$helio.projects.columns.leadTechnician",
      ...memberItem(project.leadTechnician, team),
    },
    {
      id: "crew",
      label: "$helio.projects.columns.crew",
      value: crewNames(project, team) || null,
    },
    {
      id: "address",
      label: "$helio.projects.columns.address",
      value: address,
      type: "link",
      to: directionsUrl(address),
      copyValue: address,
    },
    {
      id: "capacity",
      label: "$helio.projects.columns.capacityKwp",
      value: project.capacityKwp
        ? {
            key: "$helio.projects.detail.facts.capacity",
            params: { kwp: { type: "number", value: project.capacityKwp } },
          }
        : null,
    },
    {
      id: "budget",
      label: "$helio.projects.columns.budget",
      value: project.budget ?? null,
      type: "money",
    },
    {
      id: "start",
      label: "$helio.projects.columns.plannedStart",
      value: project.plannedStart.toISOString(),
      type: "date",
    },
    {
      id: "end",
      label: "$helio.projects.columns.plannedEnd",
      value: project.plannedEnd.toISOString(),
      type: "date",
      tone: isLate(project) ? "error" : undefined,
      detail: isLate(project) ? "$helio.projects.detail.facts.late" : undefined,
    },
  ];
}

/** How to reach the customer on the day of the installation. */
export function customerContact(bundle: ProjectBundle): KeyValueListItem[] {
  const { customer } = bundle;
  if (!customer) return [];
  return [
    {
      id: "contact",
      label: "$helio.projects.detail.contact.name",
      value: customer.contactName,
    },
    {
      id: "phone",
      label: "$helio.projects.detail.contact.phone",
      value: customer.phone,
      type: "link",
      to: `tel:${customer.phone.replace(/\s+/g, "")}`,
      copyValue: customer.phone,
    },
    {
      id: "email",
      label: "$helio.projects.detail.contact.email",
      value: customer.email,
      type: "link",
      to: `mailto:${customer.email}`,
      copyValue: customer.email,
    },
    {
      id: "vat",
      label: "$helio.projects.detail.contact.vat",
      value: customer.vatNumber ?? null,
      type: "mono",
    },
  ];
}

/**
 * The figures above the tabs. A project without tasks says so, rather than
 * that nothing is left to do.
 */
export function projectStats(bundle: ProjectBundle): StatGroupItem[] {
  const { project, tasks, invoices } = bundle;
  const counts = countTasks(tasks);
  const totals = invoiceTotals(invoices);
  const status = PROJECT_STATUSES.find((item) => item.value === project.status);
  const late = isLate(project);
  return [
    {
      id: "status",
      icon: status?.icon,
      tone: STATUS_TONES[project.status],
      eyebrow: "$helio.projects.detail.stats.status",
      value: statusLabel(project.status),
      detail: late
        ? "$helio.projects.detail.stats.late"
        : {
            key: "$helio.projects.detail.stats.ends",
            params: { date: day(project.plannedEnd) },
          },
      detailTone: late ? "error" : "neutral",
    },
    {
      id: "start",
      icon: "i-ph-calendar-blank",
      tone: "info",
      eyebrow: "$helio.projects.detail.stats.start",
      value: {
        key: "$helio.projects.detail.stats.date",
        params: { date: day(project.plannedStart) },
      },
      detail: {
        key: "$helio.projects.detail.stats.relative",
        params: {
          when: { type: "relative", value: project.plannedStart.toISOString() },
        },
      },
    },
    {
      id: "tasks",
      icon: "i-ph-list-checks",
      tone:
        counts.total > 0 && counts.done === counts.total
          ? "success"
          : "primary",
      eyebrow: "$helio.projects.detail.stats.tasks",
      value: {
        key: "$helio.projects.detail.stats.tasksValue",
        params: { done: count(counts.done), total: count(counts.total) },
        plural: "total",
      },
      detail:
        counts.total === 0
          ? "$helio.projects.detail.stats.noTasks"
          : {
              key: "$helio.projects.detail.stats.tasksOpen",
              params: { count: count(counts.todo + counts.doing) },
            },
      to: `${projectPageUrl(project._id)}?section=tasks`,
    },
    {
      id: "invoiced",
      icon: "i-ph-receipt",
      tone: totals.overdue > 0 ? "error" : "success",
      eyebrow: "$helio.projects.detail.stats.invoiced",
      value: {
        key: "$helio.projects.detail.stats.money",
        params: { amount: money(totals.invoiced) },
      },
      detail:
        invoices.length === 0
          ? "$helio.projects.detail.stats.noInvoices"
          : totals.due > 0
            ? {
                key: "$helio.projects.detail.stats.due",
                params: { amount: money(totals.due) },
              }
            : "$helio.projects.detail.stats.settled",
      detailTone: totals.overdue > 0 ? "error" : "neutral",
      to: `${projectPageUrl(project._id)}?section=invoices`,
    },
  ];
}

/** A composed money value, which takes minor units (cents). */
function money(euros: number) {
  return {
    type: "money",
    value: Math.round(euros * 100),
    currency: "EUR",
  } as const;
}

/** The answer of the task board's meter. */
export interface TaskMeter {
  value: number;
  max: number;
  segments: MeterSegment[];
  valueLabel: {
    key: string;
    params: Record<string, { type: "count"; value: number }>;
  };
}

/** The task board as one stacked bar: done, in progress, to do. */
export function taskMeter(bundle: ProjectBundle): TaskMeter {
  const counts = countTasks(bundle.tasks);
  return {
    value: counts.done,
    max: Math.max(counts.total, 1),
    segments: [
      {
        value: counts.done,
        tone: "success",
        label: {
          key: "$helio.projects.detail.progress.done",
          params: { count: count(counts.done) },
        },
      },
      {
        value: counts.doing,
        tone: "primary",
        label: {
          key: "$helio.projects.detail.progress.doing",
          params: { count: count(counts.doing) },
        },
      },
      {
        value: counts.todo,
        tone: "soft",
        label: {
          key: "$helio.projects.detail.progress.todo",
          params: { count: count(counts.todo) },
        },
      },
    ],
    valueLabel: {
      key: "$helio.projects.detail.progress.value",
      params: { done: count(counts.done), total: count(counts.total) },
    },
  };
}

/** The answer of the invoicing meter. */
export interface InvoicingMeter {
  value: number;
  max: number;
  hint: { key: string; params: Record<string, ReturnType<typeof money>> };
}

/** How much of the budget (excl. VAT) was invoiced so far. */
export function invoicingMeter(bundle: ProjectBundle): InvoicingMeter {
  const invoicedExcl = bundle.invoices
    .filter((invoice) => invoice.status !== "cancelled")
    .reduce((total, invoice) => total + invoice.amountExcl, 0);
  const budget = bundle.project.budget ?? 0;
  return {
    value: Math.round(invoicedExcl),
    max: Math.max(Math.round(budget), 1),
    hint: {
      key: "$helio.projects.detail.invoicing.hint",
      params: { invoiced: money(invoicedExcl), budget: money(budget) },
    },
  };
}

/** A banner for a project behind schedule or on hold; nothing otherwise. */
export function projectBanner(bundle: ProjectBundle): BannerContent {
  const { project } = bundle;
  if (project.status === "on_hold") {
    return {
      tone: "warning",
      icon: "i-ph-pause-circle",
      title: "$helio.projects.detail.banner.onHoldTitle",
      description:
        project.notes || "$helio.projects.detail.banner.onHoldDescription",
    };
  }
  if (isLate(project)) {
    return {
      tone: "error",
      title: "$helio.projects.detail.banner.lateTitle",
      description: {
        key: "$helio.projects.detail.banner.lateDescription",
        params: { date: day(project.plannedEnd) },
      },
    };
  }
  return {};
}
