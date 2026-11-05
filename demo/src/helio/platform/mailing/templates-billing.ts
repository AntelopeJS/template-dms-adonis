import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type {
  Condition,
  TemplateDeclaration,
} from "@antelopejs/interface-dms-mailing";
import {
  button,
  fact,
  heading,
  localeContent,
  paragraph,
  variable,
} from "./blocks";
import { HELIO_MAIL_CATEGORY, HELIO_TEMPLATES } from "./format";

const TEST_INVOICE = {
  number: "F-2026-0315",
  total: "9 874,20 €",
  amountDue: "9 874,20 €",
  dueAt: "jeudi 15 octobre 2026",
  reference: "+++202/6031/50097+++",
  url: "https://portail.helio.example/factures/F-2026-0315",
};

const invoiceIssued: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.invoiceIssued,
  name: { en: "Invoice issued", fr: "Facture émise" },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("invoice.number", "string"),
    variable("invoice.total", "money"),
    variable("invoice.dueAt", "date"),
    variable("invoice.reference", "string"),
    variable("invoice.url", "url"),
  ],
  testData: { customer: { name: "Marie Martin" }, invoice: TEST_INVOICE },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "Facture {{invoice.number}} — {{invoice.total}}",
        "À régler pour le {{invoice.dueAt}}. Communication structurée {{invoice.reference}}.",
        [
          heading("title", "Votre facture est disponible"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Veuillez trouver la facture {{invoice.number}} relative à votre installation Helio. Vous pouvez la télécharger depuis votre espace client.",
          ),
          fact("number", "Facture", "{{invoice.number}}"),
          fact("total", "Montant TVAC", "{{invoice.total}}"),
          fact("due", "Échéance", "{{invoice.dueAt}}"),
          fact(
            "reference",
            "Communication structurée",
            "{{invoice.reference}}",
          ),
          paragraph(
            "payment",
            "Merci d'effectuer le paiement par virement sur le compte BE71 0961 2345 6769 (BIC GEBABEBB) en mentionnant la communication structurée ci-dessus.",
          ),
          button("cta", "Télécharger la facture", "{{invoice.url}}"),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "Le service comptabilité Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "Invoice {{invoice.number}} — {{invoice.total}}",
        "Due by {{invoice.dueAt}}. Structured reference {{invoice.reference}}.",
        [
          heading("title", "Your invoice is available"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "Please find invoice {{invoice.number}} for your Helio installation. You can download it from your customer portal.",
          ),
          fact("number", "Invoice", "{{invoice.number}}"),
          fact("total", "Amount incl. VAT", "{{invoice.total}}"),
          fact("due", "Due date", "{{invoice.dueAt}}"),
          fact("reference", "Structured reference", "{{invoice.reference}}"),
          paragraph(
            "payment",
            "Please pay by bank transfer to BE71 0961 2345 6769 (BIC GEBABEBB), quoting the structured reference above.",
          ),
          button("cta", "Download the invoice", "{{invoice.url}}"),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "Helio accounts department"),
        ],
      ),
    },
  },
};

/** Shows the block that states what follows a non-payment, from the second reminder on. */
const FIRM_REMINDER: Condition = {
  path: "invoice.reminderNumber",
  operator: "gt",
  value: "1",
};

const invoiceReminder: TemplateDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  slug: HELIO_TEMPLATES.invoiceReminder,
  name: {
    en: "Invoice payment reminder",
    fr: "Relance de paiement de facture",
  },
  category: HELIO_MAIL_CATEGORY,
  variables: [
    variable("customer.name", "string"),
    variable("invoice.number", "string"),
    variable("invoice.amountDue", "money"),
    variable("invoice.dueAt", "date"),
    variable("invoice.daysOverdue", "number"),
    variable("invoice.reminderNumber", "number"),
    variable("invoice.reference", "string"),
    variable("invoice.url", "url"),
  ],
  testData: {
    customer: { name: "Marie Martin" },
    invoice: { ...TEST_INVOICE, daysOverdue: 18, reminderNumber: 2 },
  },
  content: {
    locales: {
      fr: localeContent(
        "fr",
        "Rappel de paiement — facture {{invoice.number}}",
        "{{invoice.amountDue}} en attente depuis le {{invoice.dueAt}}.",
        [
          heading("title", "Rappel de paiement"),
          paragraph("greeting", "Bonjour {{customer.name}},"),
          paragraph(
            "intro",
            "Sauf erreur de notre part, la facture {{invoice.number}}, échue le {{invoice.dueAt}}, reste impayée {{invoice.daysOverdue}} jours après son échéance.",
          ),
          fact("number", "Facture", "{{invoice.number}}"),
          fact("due-amount", "Montant dû", "{{invoice.amountDue}}"),
          fact("due", "Échéance", "{{invoice.dueAt}}"),
          fact(
            "reference",
            "Communication structurée",
            "{{invoice.reference}}",
          ),
          paragraph(
            "payment",
            "Nous vous remercions de bien vouloir virer le montant dû sur le compte BE71 0961 2345 6769 (BIC GEBABEBB) en mentionnant la communication structurée. Si votre paiement a croisé ce message, nous vous prions de ne pas en tenir compte.",
          ),
          paragraph(
            "firm",
            "Il s'agit de notre rappel n° {{invoice.reminderNumber}}. À défaut de paiement dans les 8 jours, nous serons contraints d'appliquer les intérêts de retard et l'indemnité forfaitaire prévus par nos conditions générales.",
            FIRM_REMINDER,
          ),
          button("cta", "Consulter la facture", "{{invoice.url}}"),
          paragraph("regards", "Bien cordialement,"),
          paragraph("signature", "Le service comptabilité Helio"),
        ],
      ),
      en: localeContent(
        "en",
        "Payment reminder — invoice {{invoice.number}}",
        "{{invoice.amountDue}} outstanding since {{invoice.dueAt}}.",
        [
          heading("title", "Payment reminder"),
          paragraph("greeting", "Dear {{customer.name}},"),
          paragraph(
            "intro",
            "Unless we are mistaken, invoice {{invoice.number}}, due on {{invoice.dueAt}}, is still unpaid {{invoice.daysOverdue}} days after its due date.",
          ),
          fact("number", "Invoice", "{{invoice.number}}"),
          fact("due-amount", "Amount due", "{{invoice.amountDue}}"),
          fact("due", "Due date", "{{invoice.dueAt}}"),
          fact("reference", "Structured reference", "{{invoice.reference}}"),
          paragraph(
            "payment",
            "We kindly ask you to transfer the amount due to BE71 0961 2345 6769 (BIC GEBABEBB), quoting the structured reference. If your payment crossed this message, please disregard it.",
          ),
          paragraph(
            "firm",
            "This is our reminder no. {{invoice.reminderNumber}}. Without payment within 8 days, we will have to apply the late-payment interest and the flat-rate recovery fee set out in our general terms.",
            FIRM_REMINDER,
          ),
          button("cta", "View the invoice", "{{invoice.url}}"),
          paragraph("regards", "Kind regards,"),
          paragraph("signature", "Helio accounts department"),
        ],
      ),
    },
  },
};

/**
 * The billing e-mails: an invoice issued, and the reminder of an unpaid one.
 * Both carry the Belgian structured reference the bank transfer quotes.
 */
export const BILLING_TEMPLATES = [invoiceIssued, invoiceReminder];
