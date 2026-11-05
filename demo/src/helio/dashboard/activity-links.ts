import type { Tone } from "@antelopejs/interface-dms/base/types";
import { HELIO_PAGES } from "./links";

export type ActivityType =
  | "deal_won"
  | "quote_sent"
  | "quote_accepted"
  | "project_started"
  | "project_done"
  | "ticket_opened"
  | "ticket_resolved"
  | "ticket_reopened"
  | "invoice_paid"
  | "invoice_overdue";

/**
 * Dashboard paths the feed links to, by record kind; `{id}` is the record's
 * `_id`, and `?record=` opens it in the list page's deep-linked drawer.
 */
export const HELIO_LINKS = {
  deal: `${HELIO_PAGES.pipeline}?record={id}`,
  quote: `${HELIO_PAGES.quotes}?record={id}`,
  project: `${HELIO_PAGES.project}/{id}`,
  ticket: `${HELIO_PAGES.service}?record={id}`,
  invoice: `${HELIO_PAGES.invoices}?record={id}`,
} as const;

export type ActivityRecordKind = keyof typeof HELIO_LINKS;

/** The tone each kind of event is drawn in, shared by the seeded history (fixtures.ts) and the live log (log.ts). */
export const ACTIVITY_TONES: Record<ActivityType, Tone> = {
  deal_won: "success",
  quote_sent: "info",
  quote_accepted: "success",
  project_started: "primary",
  project_done: "success",
  ticket_opened: "warning",
  ticket_resolved: "success",
  ticket_reopened: "warning",
  invoice_paid: "success",
  invoice_overdue: "error",
};

/** The dashboard path of one record, as the seeded history (fixtures.ts) and the live log (log.ts) link it. */
export function activityLink(kind: ActivityRecordKind, id: string): string {
  return HELIO_LINKS[kind].replace("{id}", encodeURIComponent(id));
}
