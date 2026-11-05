import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { UserModel } from "@antelopejs/interface-dms/auth/db";
import {
  Notification,
  NotificationCategory,
  NotificationSubject,
} from "@antelopejs/interface-dms/notifications";
import { CustomerModel } from "../crm/database";
import { currentSettings } from "../settings/current";
import { TeamMemberModel } from "../team/database";
import type { Ticket } from "./database";
import { SERVICE_DESK_PATH } from "./options";

/**
 * Declared at import time, before the subject that belongs to it, so the
 * subject is registered before the first urgent ticket arrives.
 */
const serviceCategory = NotificationCategory("helio-service", {
  labelKey: "helio.service.notifications.category",
  descriptionKey: "helio.service.notifications.categoryDescription",
  icon: "i-ph-lifebuoy",
});

const urgentTicketSubject = NotificationSubject("urgent-tickets", {
  category: serviceCategory,
  labelKey: "helio.service.notifications.urgentSubject",
  descriptionKey: "helio.service.notifications.urgentSubjectDescription",
  togglePermission: "allowed",
});

/**
 * Who hears of an urgent ticket: the owners, then the default technician and
 * the alert recipients, by the e-mail of their account; nobody when the
 * Settings page turns the alerts off.
 */
async function urgentTicketReaders(): Promise<string[]> {
  const settings = await currentSettings();
  if (settings.notifyUrgentTickets === false) return [];
  const users = GetModel(UserModel);
  const technician = settings.defaultTechnician
    ? await GetModel(TeamMemberModel).get(settings.defaultTechnician)
    : undefined;
  const emails = [technician?.email, ...(settings.alertRecipients ?? [])];
  const [owners, ...named] = await Promise.all([
    users.getOwners(),
    ...emails.map((email) => (email ? users.getByEmail(email) : undefined)),
  ]);
  const ids = [...owners, ...named].flatMap((user) => (user ? [user._id] : []));
  return [...new Set(ids)];
}

/**
 * Tells the owners and the people the Settings page names that an urgent
 * ticket arrived, with a notification linking straight to it (the desk
 * filters on `?ticket=<number>`). Nothing is sent when the Settings page turns
 * urgent ticket alerts off. Best effort: a failure is logged and never fails
 * the write that created the ticket.
 */
export async function notifyUrgentTicket(
  ticket: Pick<Ticket, "number" | "subject" | "customer">,
): Promise<void> {
  try {
    const [readers, customer] = await Promise.all([
      urgentTicketReaders(),
      GetModel(CustomerModel).get(ticket.customer),
    ]);
    if (readers.length === 0) return;
    await Notification()
      .icon("i-ph-fire")
      .tone("error")
      .title("$helio.service.notifications.urgent.title")
      .description("$helio.service.notifications.urgent.description")
      .params({
        number: ticket.number,
        subject: ticket.subject,
        customer: customer?.name ?? "",
      })
      .subject(urgentTicketSubject)
      .linkTo(
        `${SERVICE_DESK_PATH}?ticket=${encodeURIComponent(ticket.number)}`,
      )
      .build()
      .toUsers(readers, { readScope: "shared" });
  } catch (error) {
    Logging.Error(
      `[helio] urgent ticket notification failed: ${String(error)}`,
    );
  }
}
