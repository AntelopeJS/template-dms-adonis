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

const quoteSent: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.quoteSent,
  name: { en: "Quote sent to the customer", fr: "Devis envoyé au client" },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("quote.number", "string"),
    variable("quote.total", "money"),
    variable("quote.validUntil", "date"),
    variable("quote.url", "url"),
    variable("salesRep.name", "string"),
    variable("salesRep.email", "string"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    quote: {
      number: "Q-2026-0142",
      total: "9 874,20 €",
      validUntil: "samedi 14 novembre 2026",
      url: "https://portail.helio.example/devis/Q-2026-0142?t=demo",
    },
    salesRep: { name: "Camille Dubois", email: "camille.dubois@helio.example" },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "Votre devis Helio {{quote.number}}",
        "Montant TVAC {{quote.total}}, valable jusqu'au {{quote.validUntil}}.",
        [
          heading("title", "Votre devis est prêt"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Merci de l'intérêt que vous portez à Helio. Vous trouverez ci-dessous votre devis {{quote.number}}. Vous pouvez en consulter le détail, le télécharger en PDF et le signer en ligne depuis votre espace client.",
          ),
          fact("number", "Devis", "{{quote.number}}"),
          fact("total", "Montant TVAC", "{{quote.total}}"),
          fact("valid", "Valable jusqu'au", "{{quote.validUntil}}"),
          button("cta", "Consulter et signer le devis", "{{quote.url}}"),
          paragraph(
            "questions",
            "Une question sur le matériel, les primes ou le planning ? Répondez simplement à cet e-mail ou contactez directement {{salesRep.name}} à l'adresse {{salesRep.email}}.",
          ),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "{{salesRep.name}} — Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "Your Helio quote {{quote.number}}",
        "Amount incl. VAT {{quote.total}}, valid until {{quote.validUntil}}.",
        [
          heading("title", "Your quote is ready"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "Thank you for your interest in Helio. Please find your quote {{quote.number}} below. You can review the details, download the PDF and sign it online from your customer portal.",
          ),
          fact("number", "Quote", "{{quote.number}}"),
          fact("total", "Amount incl. VAT", "{{quote.total}}"),
          fact("valid", "Valid until", "{{quote.validUntil}}"),
          button("cta", "Review and sign the quote", "{{quote.url}}"),
          paragraph(
            "questions",
            "Any question about the equipment, the subsidies or the schedule? Simply reply to this e-mail or contact {{salesRep.name}} directly at {{salesRep.email}}.",
          ),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "{{salesRep.name}} — Helio"),
        ],
      ),
    },
  },
};

const quoteAccepted: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.quoteAccepted,
  name: {
    en: "Quote accepted: thank you and next steps",
    fr: "Devis accepté : merci et prochaines étapes",
  },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("quote.number", "string"),
    variable("quote.total", "money"),
    variable("salesRep.name", "string"),
    variable("salesRep.email", "string"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    quote: { number: "Q-2026-0142", total: "9 874,20 €" },
    salesRep: { name: "Camille Dubois", email: "camille.dubois@helio.example" },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "Merci — devis {{quote.number}} confirmé",
        "Voici les prochaines étapes de votre installation.",
        [
          heading("title", "Merci pour votre confiance"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Nous avons bien reçu votre devis {{quote.number}} signé, d'un montant de {{quote.total}} TVAC. Notre équipe prépare dès à présent votre projet.",
          ),
          paragraph("next", "Les prochaines étapes :"),
          paragraph(
            "step1",
            "1. Visite technique — un technicien vous contacte dans les 10 jours ouvrables pour examiner la toiture et le tableau électrique.",
          ),
          paragraph(
            "step2",
            "2. Démarches — nous nous chargeons de la demande de raccordement au gestionnaire de réseau et, le cas échéant, de la demande de prime.",
          ),
          paragraph(
            "step3",
            "3. Installation — nous vous confirmons la date d'intervention et le chef d'équipe par e-mail au moins une semaine à l'avance.",
          ),
          paragraph(
            "contact",
            "Votre interlocuteur reste {{salesRep.name}} ({{salesRep.email}}).",
          ),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "{{salesRep.name}} — Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "Thank you — quote {{quote.number}} confirmed",
        "Here is what happens next for your installation.",
        [
          heading("title", "Thank you for your trust"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "We have received your signed quote {{quote.number}} for {{quote.total}} incl. VAT. Our team is now preparing your project.",
          ),
          paragraph("next", "What happens next:"),
          paragraph(
            "step1",
            "1. Technical visit — a technician contacts you within 10 working days to inspect the roof and the electrical panel.",
          ),
          paragraph(
            "step2",
            "2. Paperwork — we handle the grid connection request and, where applicable, the subsidy application.",
          ),
          paragraph(
            "step3",
            "3. Installation — we confirm the installation date and the team lead by e-mail at least one week in advance.",
          ),
          paragraph(
            "contact",
            "Your contact person remains {{salesRep.name}} ({{salesRep.email}}).",
          ),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "{{salesRep.name}} — Helio"),
        ],
      ),
    },
  },
};

const installationScheduled: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.installationScheduled,
  name: { en: "Installation scheduled", fr: "Installation planifiée" },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("project.code", "string"),
    variable("project.name", "string"),
    variable("project.startDate", "date"),
    variable("project.address", "string"),
    variable("lead.name", "string"),
    variable("lead.phone", "string"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    project: {
      code: "CH-0123",
      name: "Installation photovoltaïque 6,4 kWc",
      startDate: "mardi 3 novembre 2026",
      address: "Rue de la Tête d'Or 150, 7500 Tournai",
    },
    lead: { name: "Julien Peeters", phone: "+32 470 21 43 65" },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "Installation prévue le {{project.startDate}}",
        "Chantier {{project.code}} — {{lead.name}} dirigera l'équipe sur place.",
        [
          heading("title", "La date de votre installation est confirmée"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Nous avons le plaisir de vous confirmer l'installation de votre projet {{project.name}}.",
          ),
          fact("code", "Chantier", "{{project.code}}"),
          fact("start", "Date de début", "{{project.startDate}}"),
          fact("address", "Adresse", "{{project.address}}"),
          fact("lead", "Chef d'équipe", "{{lead.name}}"),
          fact("phone", "Téléphone", "{{lead.phone}}"),
          paragraph(
            "practical",
            "L'équipe arrive entre 7 h 30 et 8 h 30. Merci de dégager l'accès au tableau électrique et à la toiture, et de prévoir une présence au début et à la fin des travaux.",
          ),
          paragraph(
            "change",
            "Un empêchement ? Prévenez-nous au moins 72 heures à l'avance au +32 4 220 50 50.",
          ),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "L'équipe planning Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "Installation scheduled on {{project.startDate}}",
        "Project {{project.code}} — {{lead.name}} will lead the team on site.",
        [
          heading("title", "Your installation date is confirmed"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "We are pleased to confirm the installation of your project {{project.name}}.",
          ),
          fact("code", "Project", "{{project.code}}"),
          fact("start", "Start date", "{{project.startDate}}"),
          fact("address", "Address", "{{project.address}}"),
          fact("lead", "Team lead", "{{lead.name}}"),
          fact("phone", "Phone", "{{lead.phone}}"),
          paragraph(
            "practical",
            "The team arrives between 7:30 and 8:30. Please keep the electrical panel and the roof access clear, and make sure someone is present at the start and at the end of the works.",
          ),
          paragraph(
            "change",
            "Need to change the date? Let us know at least 72 hours in advance on +32 4 220 50 50.",
          ),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "The Helio planning team"),
        ],
      ),
    },
  },
};

/**
 * The e-mails of the sales cycle: the quote a customer receives, the thank you
 * once it is signed, and the confirmation of the installation date.
 */
export const SALES_TEMPLATES = [
  quoteSent,
  quoteAccepted,
  installationScheduled,
];
