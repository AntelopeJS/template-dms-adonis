import { GetModel } from "@antelopejs/interface-database-decorators";
import { logActivity } from "../dashboard/log";
import { teamIdsByRole } from "../shared/roster";
import { type Ticket, TicketModel } from "./database";

/** Actor of the activity entries for a ticket nobody holds: the office's first team member. */
const DISPATCHER = teamIdsByRole("office")[0] ?? "";

/**
 * Logs the tickets just resolved or closed to the dashboard's activity feed,
 * in the name of their holder and titled like the seeded entries
 * ("T-1042 · subject").
 */
export async function logTicketsResolved(
  tickets: readonly Ticket[],
): Promise<void> {
  await logActivity(
    ...tickets.map((ticket) => ({
      type: "ticket_resolved" as const,
      actor: ticket.assignee || DISPATCHER,
      subject: `${ticket.number} · ${ticket.subject}`,
      record: { kind: "ticket" as const, id: ticket._id },
    })),
  );
}

/** Logs a ticket resolved from its form (read once written). */
export async function logTicketResolved(id: string): Promise<void> {
  const ticket = await GetModel(TicketModel).get(id);
  if (ticket?.resolvedAt) await logTicketsResolved([ticket]);
}

/**
 * Logs tickets reopened after their resolution, in the name of whoever
 * holds them.
 */
export async function logTicketsReopened(
  tickets: readonly Ticket[],
): Promise<void> {
  await logActivity(
    ...tickets.map((ticket) => ({
      type: "ticket_reopened" as const,
      actor: ticket.assignee || DISPATCHER,
      subject: `${ticket.number} · ${ticket.subject}`,
      record: { kind: "ticket" as const, id: ticket._id },
    })),
  );
}

/** Logs a ticket reopened from its form (read once written). */
export async function logTicketReopened(id: string): Promise<void> {
  const ticket = await GetModel(TicketModel).get(id);
  if (ticket && !ticket.resolvedAt) await logTicketsReopened([ticket]);
}
