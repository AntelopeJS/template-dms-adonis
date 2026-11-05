import { padId } from "./seed";

export type TeamRole = "manager" | "sales" | "technician" | "office";

export interface TeamRosterEntry {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
}

/** The Helio team, shared by several domains: fixtures of other domains reference these ids. */
export const TEAM_ROSTER: readonly TeamRosterEntry[] = [
  {
    id: "team-01",
    name: "Sophie Lambert",
    email: "sophie.lambert@helio.example",
    role: "manager",
  },
  {
    id: "team-02",
    name: "Thomas Renard",
    email: "thomas.renard@helio.example",
    role: "sales",
  },
  {
    id: "team-03",
    name: "Camille Dubois",
    email: "camille.dubois@helio.example",
    role: "sales",
  },
  {
    id: "team-04",
    name: "Nicolas Martens",
    email: "nicolas.martens@helio.example",
    role: "sales",
  },
  {
    id: "team-05",
    name: "Julien Peeters",
    email: "julien.peeters@helio.example",
    role: "technician",
  },
  {
    id: "team-06",
    name: "Laura Simon",
    email: "laura.simon@helio.example",
    role: "technician",
  },
  {
    id: "team-07",
    name: "Mehdi Benali",
    email: "mehdi.benali@helio.example",
    role: "technician",
  },
  {
    id: "team-08",
    name: "Kevin Wouters",
    email: "kevin.wouters@helio.example",
    role: "technician",
  },
  {
    id: "team-09",
    name: "Elise Lemaire",
    email: "elise.lemaire@helio.example",
    role: "technician",
  },
  {
    id: "team-10",
    name: "Antoine Collard",
    email: "antoine.collard@helio.example",
    role: "technician",
  },
  {
    id: "team-11",
    name: "Nadia Haddad",
    email: "nadia.haddad@helio.example",
    role: "office",
  },
  {
    id: "team-12",
    name: "Pierre Jacobs",
    email: "pierre.jacobs@helio.example",
    role: "office",
  },
];

/** The ids of the team members holding a role. */
export const teamIdsByRole = (role: TeamRole): string[] =>
  TEAM_ROSTER.filter((member) => member.role === role).map(({ id }) => id);

export interface ProductCategoryRosterEntry {
  id: string;
  name: { en: string; fr: string };
  parent?: string;
}

/** The product categories, on two levels so the catalog can show a CascaderRelationType. */
export const PRODUCT_CATEGORY_ROSTER: readonly ProductCategoryRosterEntry[] = [
  { id: "cat-panels", name: { en: "Solar panels", fr: "Panneaux solaires" } },
  {
    id: "cat-panels-mono",
    name: { en: "Monocrystalline", fr: "Monocristallins" },
    parent: "cat-panels",
  },
  {
    id: "cat-panels-bifacial",
    name: { en: "Bifacial", fr: "Bifaciaux" },
    parent: "cat-panels",
  },
  { id: "cat-inverters", name: { en: "Inverters", fr: "Onduleurs" } },
  {
    id: "cat-inverters-string",
    name: { en: "String inverters", fr: "Onduleurs string" },
    parent: "cat-inverters",
  },
  {
    id: "cat-inverters-hybrid",
    name: { en: "Hybrid inverters", fr: "Onduleurs hybrides" },
    parent: "cat-inverters",
  },
  {
    id: "cat-inverters-micro",
    name: { en: "Micro-inverters", fr: "Micro-onduleurs" },
    parent: "cat-inverters",
  },
  { id: "cat-storage", name: { en: "Storage", fr: "Stockage" } },
  {
    id: "cat-storage-battery",
    name: { en: "Home batteries", fr: "Batteries domestiques" },
    parent: "cat-storage",
  },
  { id: "cat-ev", name: { en: "EV charging", fr: "Recharge VE" } },
  {
    id: "cat-ev-wallbox",
    name: { en: "Wallboxes", fr: "Bornes murales" },
    parent: "cat-ev",
  },
  { id: "cat-services", name: { en: "Services", fr: "Services" } },
  {
    id: "cat-services-install",
    name: { en: "Installation", fr: "Installation" },
    parent: "cat-services",
  },
  {
    id: "cat-services-maintenance",
    name: { en: "Maintenance", fr: "Entretien" },
    parent: "cat-services",
  },
];

export interface ProductRosterEntry {
  id: string;
  sku: string;
  name: string;
  /** A leaf of PRODUCT_CATEGORY_ROSTER. */
  category: string;
  /** Unit price excluding VAT, in euros. */
  price: number;
  /** Peak power in watts for panels, capacity in Wh for batteries, kW·1000 for chargers; 0 otherwise. */
  power: number;
  unit: "piece" | "hour" | "year" | "flat";
}

/** The product catalog, shared by several domains: fixtures of other domains reference these ids. */
export const PRODUCT_ROSTER: readonly ProductRosterEntry[] = [
  {
    id: "prod-01",
    sku: "PV-MONO-410",
    name: "Helio Mono 410 W",
    category: "cat-panels-mono",
    price: 189,
    power: 410,
    unit: "piece",
  },
  {
    id: "prod-02",
    sku: "PV-MONO-430",
    name: "Helio Mono 430 W noir intégral",
    category: "cat-panels-mono",
    price: 219,
    power: 430,
    unit: "piece",
  },
  {
    id: "prod-03",
    sku: "PV-MONO-450",
    name: "Helio Mono 450 W",
    category: "cat-panels-mono",
    price: 239,
    power: 450,
    unit: "piece",
  },
  {
    id: "prod-04",
    sku: "PV-BIF-540",
    name: "Helio Bifacial 540 W",
    category: "cat-panels-bifacial",
    price: 289,
    power: 540,
    unit: "piece",
  },
  {
    id: "prod-05",
    sku: "PV-BIF-580",
    name: "Helio Bifacial 580 W",
    category: "cat-panels-bifacial",
    price: 319,
    power: 580,
    unit: "piece",
  },
  {
    id: "prod-06",
    sku: "INV-STR-5K",
    name: "Onduleur string 5 kW",
    category: "cat-inverters-string",
    price: 1290,
    power: 5000,
    unit: "piece",
  },
  {
    id: "prod-07",
    sku: "INV-STR-10K",
    name: "Onduleur string 10 kW",
    category: "cat-inverters-string",
    price: 1890,
    power: 10000,
    unit: "piece",
  },
  {
    id: "prod-08",
    sku: "INV-STR-30K",
    name: "Onduleur triphasé 30 kW",
    category: "cat-inverters-string",
    price: 3990,
    power: 30000,
    unit: "piece",
  },
  {
    id: "prod-09",
    sku: "INV-HYB-6K",
    name: "Onduleur hybride 6 kW",
    category: "cat-inverters-hybrid",
    price: 2190,
    power: 6000,
    unit: "piece",
  },
  {
    id: "prod-10",
    sku: "INV-HYB-10K",
    name: "Onduleur hybride 10 kW",
    category: "cat-inverters-hybrid",
    price: 2890,
    power: 10000,
    unit: "piece",
  },
  {
    id: "prod-11",
    sku: "INV-MIC-800",
    name: "Micro-onduleur 800 W",
    category: "cat-inverters-micro",
    price: 179,
    power: 800,
    unit: "piece",
  },
  {
    id: "prod-12",
    sku: "BAT-5",
    name: "Batterie domestique 5 kWh",
    category: "cat-storage-battery",
    price: 2490,
    power: 5000,
    unit: "piece",
  },
  {
    id: "prod-13",
    sku: "BAT-10",
    name: "Batterie domestique 10 kWh",
    category: "cat-storage-battery",
    price: 4290,
    power: 10000,
    unit: "piece",
  },
  {
    id: "prod-14",
    sku: "BAT-15",
    name: "Batterie domestique 15 kWh",
    category: "cat-storage-battery",
    price: 5990,
    power: 15000,
    unit: "piece",
  },
  {
    id: "prod-15",
    sku: "EV-WB-7",
    name: "Borne murale 7,4 kW",
    category: "cat-ev-wallbox",
    price: 890,
    power: 7400,
    unit: "piece",
  },
  {
    id: "prod-16",
    sku: "EV-WB-11",
    name: "Borne murale 11 kW connectée",
    category: "cat-ev-wallbox",
    price: 1190,
    power: 11000,
    unit: "piece",
  },
  {
    id: "prod-17",
    sku: "EV-WB-22",
    name: "Borne murale 22 kW professionnelle",
    category: "cat-ev-wallbox",
    price: 1690,
    power: 22000,
    unit: "piece",
  },
  {
    id: "prod-18",
    sku: "SRV-INST-RES",
    name: "Installation résidentielle",
    category: "cat-services-install",
    price: 1450,
    power: 0,
    unit: "flat",
  },
  {
    id: "prod-19",
    sku: "SRV-INST-COM",
    name: "Installation professionnelle (par kWc)",
    category: "cat-services-install",
    price: 180,
    power: 0,
    unit: "piece",
  },
  {
    id: "prod-20",
    sku: "SRV-ROOF",
    name: "Étude de toiture et contrôle de structure",
    category: "cat-services-install",
    price: 290,
    power: 0,
    unit: "flat",
  },
  {
    id: "prod-21",
    sku: "SRV-HOUR",
    name: "Heure de technicien",
    category: "cat-services-maintenance",
    price: 75,
    power: 0,
    unit: "hour",
  },
  {
    id: "prod-22",
    sku: "SRV-MAINT-1Y",
    name: "Contrat d'entretien (annuel)",
    category: "cat-services-maintenance",
    price: 149,
    power: 0,
    unit: "year",
  },
  {
    id: "prod-23",
    sku: "SRV-MON-1Y",
    name: "Abonnement monitoring (annuel)",
    category: "cat-services-maintenance",
    price: 59,
    power: 0,
    unit: "year",
  },
  {
    id: "prod-24",
    sku: "SRV-CLEAN",
    name: "Nettoyage des panneaux",
    category: "cat-services-maintenance",
    price: 4,
    power: 0,
    unit: "piece",
  },
];

/**
 * How many rows each generated collection holds. Ids are `padId(prefix, i, width)`
 * for i in 1..COUNT, e.g. cust-001 … cust-060.
 */
export const COUNTS = {
  customers: 60,
  deals: 120,
  quotes: 150,
  projects: 80,
  sites: 40,
  tickets: 300,
  invoices: 200,
} as const;

export const customerId = (index: number): string => padId("cust", index, 3);
export const dealId = (index: number): string => padId("deal", index, 3);
export const quoteId = (index: number): string => padId("quote", index, 3);
export const projectId = (index: number): string => padId("proj", index, 3);
export const siteId = (index: number): string => padId("site", index, 2);
export const ticketId = (index: number): string => padId("ticket", index, 3);
export const invoiceId = (index: number): string => padId("inv", index, 3);
