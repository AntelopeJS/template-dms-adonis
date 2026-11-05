import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type { TemplateDeclaration } from "@antelopejs/interface-dms-mailing";
import {
  button,
  fact,
  heading,
  localeContent,
  paragraph,
  variable,
} from "./blocks";
import { HELIO_MAIL_CATEGORY, HELIO_TEMPLATES } from "./format";

const TEST_TICKET = {
  number: "T-1187",
  subject: "Onduleur en défaut depuis ce matin",
  url: "https://portail.helio.example/tickets/T-1187",
};

const ticketReceived: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.ticketReceived,
  name: { en: "Service request received", fr: "Demande d'intervention reçue" },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("ticket.number", "string"),
    variable("ticket.subject", "string"),
    variable("ticket.responseBy", "date"),
    variable("ticket.url", "url"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    ticket: { ...TEST_TICKET, responseBy: "20 octobre à 14:00" },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "[{{ticket.number}}] Nous avons bien reçu votre demande",
        "{{ticket.subject}} — réponse au plus tard le {{ticket.responseBy}}.",
        [
          heading("title", "Votre demande est enregistrée"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Merci d'avoir contacté le service client Helio. Votre demande est enregistrée sous le numéro {{ticket.number}}.",
          ),
          fact("number", "Ticket", "{{ticket.number}}"),
          fact("subject", "Objet", "{{ticket.subject}}"),
          fact("sla", "Réponse au plus tard", "{{ticket.responseBy}}"),
          paragraph(
            "next",
            "Un technicien l'examine et revient vers vous avant l'échéance indiquée. Si votre installation est totalement à l'arrêt ou si vous constatez une odeur de brûlé ou des dégâts, appelez-nous immédiatement au +32 4 220 50 50.",
          ),
          button("cta", "Suivre ma demande", "{{ticket.url}}"),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "Le service client Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "[{{ticket.number}}] We have received your request",
        "{{ticket.subject}} — we reply by {{ticket.responseBy}} at the latest.",
        [
          heading("title", "Your request is registered"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "Thank you for contacting Helio customer service. Your request is registered under number {{ticket.number}}.",
          ),
          fact("number", "Ticket", "{{ticket.number}}"),
          fact("subject", "Subject", "{{ticket.subject}}"),
          fact("sla", "Response by", "{{ticket.responseBy}}"),
          paragraph(
            "next",
            "A technician reviews it and gets back to you before that time. If your installation is completely down, or if you notice a burning smell or any damage, call us immediately on +32 4 220 50 50.",
          ),
          button("cta", "Follow my request", "{{ticket.url}}"),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "Helio customer service"),
        ],
      ),
    },
  },
};

const ticketResolved: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.ticketResolved,
  name: {
    en: "Service request resolved",
    fr: "Demande d'intervention résolue",
  },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("ticket.number", "string"),
    variable("ticket.subject", "string"),
    variable("ticket.resolvedAt", "date"),
    variable("ticket.url", "url"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    ticket: { ...TEST_TICKET, resolvedAt: "mardi 20 octobre 2026" },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "[{{ticket.number}}] Votre demande est résolue",
        "{{ticket.subject}}",
        [
          heading("title", "Votre demande est résolue"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Nous avons résolu votre demande {{ticket.number}} — {{ticket.subject}} — le {{ticket.resolvedAt}}.",
          ),
          paragraph(
            "reopen",
            "Si le problème réapparaît ou si la solution ne vous convient pas, répondez simplement à cet e-mail dans les 14 jours et nous rouvrirons votre demande.",
          ),
          button("cta", "Consulter la demande", "{{ticket.url}}"),
          paragraph("regards", "Merci pour votre confiance,"),
          paragraph("signature", "Le service client Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "[{{ticket.number}}] Your request is resolved",
        "{{ticket.subject}}",
        [
          heading("title", "Your request is resolved"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "We resolved your request {{ticket.number}} — {{ticket.subject}} — on {{ticket.resolvedAt}}.",
          ),
          paragraph(
            "reopen",
            "If the problem comes back or the solution does not suit you, simply reply to this e-mail within 14 days and we will reopen your request.",
          ),
          button("cta", "View the request", "{{ticket.url}}"),
          paragraph("regards", "Thank you for your trust,"),
          paragraph("signature", "Helio customer service"),
        ],
      ),
    },
  },
};

/**
 * The after-sales e-mails: the acknowledgement of a service request, with the
 * time Helio commits to answer by, and the notice once it is resolved.
 */
export const SERVICE_TEMPLATES = [ticketReceived, ticketResolved];
