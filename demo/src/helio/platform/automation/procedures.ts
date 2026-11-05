import type { ProcedureDeclaration } from "@antelopejs/interface-dms-automation";
import { graph, next, node, wire } from "./graph";
import { HELIO_TRIGGERS } from "./triggers";

/** The webhook a monitoring platform posts its alerts to (on the API server). */
export const MONITORING_WEBHOOK_PATH = "/hooks/helio/monitoring-alert";

const NOTIFY = "dms.send-notification";
const MANAGERS = "helio.find-managers";

const urgentTicketDispatch: ProcedureDeclaration = {
  id: "helio.urgent-ticket-dispatch",
  name: "Ticket urgent → attribuer au technicien de garde",
  description:
    "À l'arrivée d'un ticket urgent, le technicien qui a le moins de tickets ouverts le prend en charge et les responsables sont prévenus, sauf si les paramètres coupent les alertes de tickets urgents.",
  enabled: true,
  graph: graph(
    [
      node("urgent", "trigger", HELIO_TRIGGERS.ticketOpened, [0, 0], {
        priority: "urgent",
      }),
      node("assign", "action", "helio.assign-on-call", [1, 0]),
      node("if", "if", undefined, [2, 0]),
      node("managers", "action", MANAGERS, [3, 0]),
      node("notify", "action", NOTIFY, [4, 0], {
        title: "Ticket urgent attribué",
        icon: "i-ph-siren",
      }),
    ],
    [
      next("urgent", "assign"),
      next("assign", "if"),
      next("if", "managers", "then"),
      next("managers", "notify"),
    ],
    [
      wire("urgent", "ticketId", "assign", "ticketId"),
      wire("assign", "alertsOn", "if", "cond"),
      wire("managers", "userIds", "notify", "userIds"),
      wire("assign", "summary", "notify", "description"),
      wire("assign", "link", "notify", "linkTo"),
    ],
  ),
};

const overdueInvoiceReminders: ProcedureDeclaration = {
  id: "helio.overdue-invoice-reminders",
  name: "En semaine à 8 h → relancer les factures en retard selon le calendrier",
  description:
    "Chaque matin de semaine, chaque facture en retard reçoit la relance suivante du calendrier des paramètres (Finance › Recouvrement) dès qu'elle en atteint le délai, au plus une par semaine : par e-mail, ou notée pour l'envoi d'un recommandé. Les responsables sont ensuite prévenus.",
  enabled: true,
  graph: graph(
    [
      node("weekday", "trigger", "schedule.cron", [0, 0], {
        cron: "0 8 * * 1-5",
      }),
      node("manual", "trigger", "manual", [0, 1]),
      node("remind", "action", "helio.remind-overdue-invoices", [1, 0], {
        minDaysBetween: 7,
      }),
      node("none", "data", "const.number", [1, 1], { value: 0 }),
      node("any", "data", "compare.gt", [2, 1]),
      node("if", "if", undefined, [2, 0]),
      node("managers", "action", MANAGERS, [3, 0]),
      node("notify", "action", NOTIFY, [4, 0], {
        title: "Rappels de paiement envoyés",
        icon: "i-ph-envelope-simple-open",
        linkTo: "/helio/invoices?table.tab=overdue",
      }),
    ],
    [
      next("weekday", "remind"),
      next("manual", "remind"),
      next("remind", "if"),
      next("if", "managers", "then"),
      next("managers", "notify"),
    ],
    [
      wire("remind", "reminded", "any", "a"),
      wire("none", "value", "any", "b"),
      wire("any", "result", "if", "cond"),
      wire("managers", "userIds", "notify", "userIds"),
      wire("remind", "summary", "notify", "description"),
    ],
  ),
};

const monitoringAlertTicket: ProcedureDeclaration = {
  id: "helio.monitoring-alert-ticket",
  name: "Alerte de supervision (webhook) → ouvrir un ticket SAV",
  description: `La plateforme de supervision envoie { siteId, alert, severity, message } à ${MONITORING_WEBHOOK_PATH} : un ticket est ouvert sur le site (un par problème en cours), urgent si l'alerte est critique.`,
  enabled: true,
  graph: graph(
    [
      node("alert", "trigger", "webhook", [0, 0], {
        path: MONITORING_WEBHOOK_PATH,
        method: "POST",
      }),
      node("ticket", "action", "helio.create-ticket", [1, 0]),
      node("log", "action", "log.message", [2, 0], { level: "info" }),
    ],
    [next("alert", "ticket"), next("ticket", "log")],
    [
      wire("alert", "body", "ticket", "payload"),
      wire("ticket", "summary", "log", "message"),
    ],
  ),
};

const quoteAcceptedKickoff: ProcedureDeclaration = {
  id: "helio.quote-accepted-kickoff",
  name: "Devis accepté → planifier le lancement",
  description:
    "Quand un client signe un devis, un appel de lancement est ajouté à son chantier (ou à la prochaine étape de l'affaire) et les responsables sont prévenus.",
  enabled: true,
  graph: graph(
    [
      node("accepted", "trigger", HELIO_TRIGGERS.quoteAccepted, [0, 0]),
      node("kickoff", "action", "helio.plan-kickoff", [1, 0]),
      node("managers", "action", MANAGERS, [2, 0]),
      node("notify", "action", NOTIFY, [3, 0], {
        title: "Devis signé : lancement à planifier",
        icon: "i-ph-flag-banner",
      }),
    ],
    [
      next("accepted", "kickoff"),
      next("kickoff", "managers"),
      next("managers", "notify"),
    ],
    [
      wire("accepted", "quoteId", "kickoff", "quoteId"),
      wire("managers", "userIds", "notify", "userIds"),
      wire("kickoff", "summary", "notify", "description"),
      wire("kickoff", "link", "notify", "linkTo"),
    ],
  ),
};

const installationConfirmations: ProcedureDeclaration = {
  id: "helio.installation-confirmations",
  name: "Le vendredi à 14 h → confirmer les prochaines installations",
  description:
    "Chaque vendredi après-midi, envoie par e-mail aux clients dont l'installation commence dans les 14 jours la date, l'adresse et leur chef d'équipe (une fois par chantier).",
  enabled: true,
  graph: graph(
    [
      node("friday", "trigger", "schedule.cron", [0, 0], {
        cron: "0 14 * * 5",
      }),
      node("manual", "trigger", "manual", [0, 1]),
      node("confirm", "action", "helio.confirm-installations", [1, 0], {
        daysAhead: 14,
      }),
      node("log", "action", "log.message", [2, 0], { level: "info" }),
    ],
    [
      next("friday", "confirm"),
      next("manual", "confirm"),
      next("confirm", "log"),
    ],
    [wire("confirm", "summary", "log", "message")],
  ),
};

/**
 * The procedures Helio ships, as the builder would export them. Each one is
 * declared on every boot; the automation module creates it once, refreshes it
 * while nobody touched it, and keeps whatever a user changed since. Names and
 * descriptions are shown as written because the automation pages do not
 * translate them, so they are in French, the demo's language, as are the
 * titles of the notifications the nodes send.
 */
export const HELIO_PROCEDURES = [
  urgentTicketDispatch,
  overdueInvoiceReminders,
  monitoringAlertTicket,
  quoteAcceptedKickoff,
  installationConfirmations,
];

/** Procedures with a manual trigger, run once when first created. */
export const FIRST_RUN_PROCEDURES = new Set([
  overdueInvoiceReminders.id,
  installationConfirmations.id,
]);

/**
 * Procedures that notify the platform owners ("Find the managers"): their
 * first run needs an owner, which only the onboarding creates.
 */
export const OWNER_NOTIFYING_PROCEDURES = new Set(
  HELIO_PROCEDURES.filter(({ graph }) =>
    graph.nodes.some((node) => node.typeId === MANAGERS),
  ).map(({ id }) => id),
);
