import type { FeatureValueType } from "@antelopejs/interface-dms-saas/db";

/** One text per locale, e.g. `{ en: "Users", fr: "Utilisateurs" }`. */
export type LocalizedText = Record<string, string>;

export interface SeedFeature {
  id: string;
  displayName: LocalizedText;
  description: LocalizedText;
  tooltip: LocalizedText | null;
  valueType: FeatureValueType;
  defaultValue: boolean | number;
  /** `singular | plural` where the unit agrees with its number. */
  unit: LocalizedText | null;
  isDetailRow: boolean;
  order: number;
}

export const FEATURE_IDS = {
  users: "helio-users",
  quotes: "helio-quotes-invoices",
  pipeline: "helio-sales-pipeline",
  serviceDesk: "helio-service-desk",
  fleet: "helio-fleet-monitoring",
  sites: "helio-monitored-sites",
  automation: "helio-automation",
  api: "helio-api-access",
  storage: "helio-storage",
  support: "helio-support-response",
  sso: "helio-sso",
} as const;

const F = FEATURE_IDS;

/**
 * What the Helio plans are compared on, on the pricing page and in the plan
 * editor. dms-saas stores feature texts localized in the row itself (one text
 * per language), not as i18n keys, so both languages are written here.
 */
export const FEATURES: SeedFeature[] = [
  {
    id: F.users,
    displayName: { en: "Users included", fr: "Utilisateurs inclus" },
    description: {
      en: "Office staff, sales reps and technicians who sign in to Helio.",
      fr: "Employés de bureau, commerciaux et techniciens qui se connectent à Helio.",
    },
    tooltip: null,
    valueType: "number",
    defaultValue: 1,
    unit: { en: "user | users", fr: "utilisateur | utilisateurs" },
    isDetailRow: false,
    order: 1,
  },
  {
    id: F.quotes,
    displayName: {
      en: "Quotes, projects & invoices",
      fr: "Devis, chantiers et factures",
    },
    description: {
      en: "Customer file, product catalogue, PDF quotes, installation projects and invoicing.",
      fr: "Fichier clients, catalogue produits, devis PDF, chantiers d'installation et facturation.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: true,
    unit: null,
    isDetailRow: false,
    order: 2,
  },
  {
    id: F.pipeline,
    displayName: { en: "Sales pipeline", fr: "Pipeline commercial" },
    description: {
      en: "Kanban of every deal from first contact to signature, with weighted forecasts.",
      fr: "Kanban de chaque affaire, du premier contact à la signature, avec prévisions pondérées.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: false,
    order: 3,
  },
  {
    id: F.serviceDesk,
    displayName: { en: "Service desk & SLA", fr: "Service après-vente et SLA" },
    description: {
      en: "After-sales tickets with priorities, SLA deadlines and technician assignment.",
      fr: "Tickets après-vente avec priorités, échéances SLA et affectation des techniciens.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: false,
    order: 4,
  },
  {
    id: F.fleet,
    displayName: {
      en: "Live fleet monitoring",
      fr: "Supervision du parc en temps réel",
    },
    description: {
      en: "Real-time production and inverter status of every installed site.",
      fr: "Production et état des onduleurs de chaque site installé, en temps réel.",
    },
    tooltip: {
      en: "Alerts open a service ticket automatically when a site goes offline.",
      fr: "Les alertes ouvrent automatiquement un ticket quand un site passe hors ligne.",
    },
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: false,
    order: 5,
  },
  {
    id: F.sites,
    displayName: { en: "Monitored sites", fr: "Sites supervisés" },
    description: {
      en: "Installations whose telemetry Helio collects.",
      fr: "Installations dont Helio collecte la télémétrie.",
    },
    tooltip: null,
    valueType: "number",
    defaultValue: 0,
    unit: { en: "site | sites", fr: "site | sites" },
    isDetailRow: true,
    order: 6,
  },
  {
    id: F.automation,
    displayName: {
      en: "Workflow automation",
      fr: "Automatisation des processus",
    },
    description: {
      en: "Automatic follow-ups, reminders and alerts between sales, projects and service.",
      fr: "Relances, rappels et alertes automatiques entre ventes, chantiers et SAV.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: false,
    order: 7,
  },
  {
    id: F.api,
    displayName: { en: "API access", fr: "Accès API" },
    description: {
      en: "REST API and webhooks to connect accounting, inverters and the website.",
      fr: "API REST et webhooks pour relier la comptabilité, les onduleurs et le site web.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: true,
    order: 8,
  },
  {
    id: F.storage,
    displayName: { en: "Document storage", fr: "Stockage de documents" },
    description: {
      en: "Site photos, signed quotes, certificates and technical sheets.",
      fr: "Photos de chantier, devis signés, attestations et fiches techniques.",
    },
    tooltip: null,
    valueType: "number",
    defaultValue: 1,
    unit: { en: "GB | GB", fr: "Go | Go" },
    isDetailRow: true,
    order: 9,
  },
  {
    id: F.support,
    displayName: {
      en: "Support response time",
      fr: "Délai de réponse du support",
    },
    description: {
      en: "Maximum time before a Helio specialist answers, on business days.",
      fr: "Délai maximal avant la réponse d'un spécialiste Helio, en jours ouvrables.",
    },
    tooltip: null,
    valueType: "number",
    defaultValue: 48,
    unit: { en: "hour | hours", fr: "heure | heures" },
    isDetailRow: true,
    order: 10,
  },
  {
    id: F.sso,
    displayName: {
      en: "Single sign-on (SSO)",
      fr: "Authentification unique (SSO)",
    },
    description: {
      en: "Sign in with Microsoft Entra ID or Google Workspace.",
      fr: "Connexion avec Microsoft Entra ID ou Google Workspace.",
    },
    tooltip: null,
    valueType: "boolean",
    defaultValue: false,
    unit: null,
    isDetailRow: true,
    order: 11,
  },
];
