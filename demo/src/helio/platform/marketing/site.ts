import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type {
  MarketingFunnelDeclaration,
  MarketingWebsiteDeclaration,
} from "@antelopejs/interface-dms-marketing";
import { DAY_MS } from "../../shared/seed";

export const WEBSITE_ID = "helio-website";
export const SITE_ORIGIN = "https://helio.example";

/**
 * Helio's public website as the marketing module knows it. Its domain is the
 * company's domain in the settings; `www` and the customer portal are
 * subdomains, so they are accepted too.
 */
export const HELIO_WEBSITE: MarketingWebsiteDeclaration = {
  tenantId: DEFAULT_TENANT_ID,
  id: WEBSITE_ID,
  name: "Helio — site public",
  domain: "helio.example",
};

export type PageId =
  | "home"
  | "pv"
  | "battery"
  | "ev"
  | "business"
  | "simulator"
  | "quote"
  | "quoteSent"
  | "offer"
  | "projects"
  | "projectCase"
  | "blog"
  | "blogPrime"
  | "blogProsumer"
  | "blogOrientation"
  | "blogEv"
  | "about"
  | "contact"
  | "faq"
  | "datasheets";

export const PAGES: Record<PageId, readonly [path: string, title: string]> = {
  home: ["/", "Helio — Panneaux solaires, batteries et bornes à Liège"],
  pv: [
    "/particuliers/panneaux-solaires",
    "Panneaux solaires pour votre maison | Helio",
  ],
  battery: ["/particuliers/batteries", "Batterie domestique | Helio"],
  ev: [
    "/particuliers/bornes-de-recharge",
    "Borne de recharge à domicile | Helio",
  ],
  business: ["/entreprises", "Le solaire pour les entreprises | Helio"],
  simulator: ["/simulateur", "Simulateur d'économies solaires | Helio"],
  quote: ["/devis", "Demander un devis gratuit | Helio"],
  quoteSent: ["/devis/merci", "Demande envoyée | Helio"],
  offer: [
    "/offres/automne-batterie",
    "Offre d'automne : -15 % sur la batterie | Helio",
  ],
  projects: ["/realisations", "Nos réalisations | Helio"],
  projectCase: [
    "/realisations/clinique-veterinaire-des-fagnes",
    "134 kWc pour la Clinique vétérinaire des Fagnes | Helio",
  ],
  blog: ["/blog", "Le blog de l'énergie solaire | Helio"],
  blogPrime: [
    "/blog/prime-batterie-wallonie-2026",
    "Prime batterie en Wallonie : ce qui change en 2026",
  ],
  blogProsumer: [
    "/blog/tarif-prosumer-explique",
    "Le tarif prosumer expliqué simplement",
  ],
  blogOrientation: [
    "/blog/orientation-toiture-rendement",
    "Orientation de la toiture et rendement des panneaux",
  ],
  blogEv: [
    "/blog/recharger-sa-voiture-au-soleil",
    "Recharger sa voiture au soleil : mode d'emploi",
  ],
  about: ["/a-propos", "À propos de Helio, installateur liégeois"],
  contact: ["/contact", "Contact et rappel gratuit | Helio"],
  faq: ["/faq", "Questions fréquentes | Helio"],
  datasheets: ["/fiches-techniques", "Fiches techniques des produits | Helio"],
};

type Next = PageId | "exit";

/**
 * Where a visitor goes after each page, with relative weights. The
 * simulator's step to the quote form is not drawn here: it is decided by the
 * visitor's A/B arm in `journeys.ts`, and this table covers the other moves.
 */
export const TRANSITIONS: Record<
  PageId,
  ReadonlyArray<readonly [Next, number]>
> = {
  home: [
    ["pv", 22],
    ["simulator", 16],
    ["battery", 9],
    ["ev", 6],
    ["business", 5],
    ["projects", 7],
    ["offer", 4],
    ["contact", 5],
    ["about", 3],
    ["exit", 30],
  ],
  pv: [
    ["simulator", 30],
    ["projects", 8],
    ["datasheets", 6],
    ["faq", 6],
    ["quote", 6],
    ["exit", 38],
  ],
  battery: [
    ["simulator", 18],
    ["offer", 10],
    ["blogPrime", 6],
    ["datasheets", 6],
    ["quote", 6],
    ["exit", 46],
  ],
  ev: [
    ["simulator", 10],
    ["blogEv", 8],
    ["datasheets", 6],
    ["quote", 8],
    ["exit", 52],
  ],
  business: [
    ["projectCase", 18],
    ["projects", 10],
    ["contact", 16],
    ["quote", 8],
    ["exit", 46],
  ],
  simulator: [
    ["pv", 6],
    ["faq", 6],
    ["contact", 6],
    ["exit", 70],
  ],
  quote: [
    ["faq", 8],
    ["contact", 6],
    ["exit", 80],
  ],
  quoteSent: [
    ["projects", 12],
    ["blog", 6],
    ["exit", 82],
  ],
  offer: [
    ["simulator", 14],
    ["battery", 10],
    ["faq", 6],
    ["exit", 58],
  ],
  projects: [
    ["projectCase", 22],
    ["simulator", 12],
    ["quote", 6],
    ["exit", 52],
  ],
  projectCase: [
    ["business", 10],
    ["contact", 12],
    ["quote", 6],
    ["exit", 66],
  ],
  blog: [
    ["blogPrime", 18],
    ["blogProsumer", 16],
    ["blogOrientation", 12],
    ["blogEv", 8],
    ["exit", 40],
  ],
  blogPrime: [
    ["battery", 16],
    ["simulator", 12],
    ["offer", 8],
    ["blog", 8],
    ["exit", 56],
  ],
  blogProsumer: [
    ["simulator", 18],
    ["battery", 10],
    ["blog", 8],
    ["exit", 64],
  ],
  blogOrientation: [
    ["simulator", 20],
    ["pv", 10],
    ["blog", 6],
    ["exit", 64],
  ],
  blogEv: [
    ["ev", 20],
    ["simulator", 6],
    ["blog", 6],
    ["exit", 68],
  ],
  about: [
    ["contact", 16],
    ["projects", 14],
    ["exit", 70],
  ],
  contact: [
    ["faq", 6],
    ["exit", 94],
  ],
  faq: [
    ["simulator", 12],
    ["contact", 10],
    ["quote", 6],
    ["exit", 72],
  ],
  datasheets: [
    ["quote", 8],
    ["simulator", 8],
    ["exit", 84],
  ],
};

/** A clickable element of a page, as the tracker anchors clicks to it. */
export interface Hotspot {
  selector: string;
  /** Centre of the element, viewport (x, y) and document (dy) fractions. */
  x: number;
  y: number;
  dy: number;
  weight: number;
  /** How many elements match the selector (FAQ entries, orientation buttons). */
  count?: number;
  /** Direction the matching elements are laid out in. */
  axis?: "x" | "y";
}

export const HOTSPOTS: Partial<Record<PageId, readonly Hotspot[]>> = {
  home: [
    { selector: "#hero a.btn-primary", x: 0.3, y: 0.56, dy: 0.12, weight: 30 },
    {
      selector: "#hero a.btn-secondary",
      x: 0.47,
      y: 0.56,
      dy: 0.12,
      weight: 12,
    },
    {
      selector: "header nav a.menu-simulateur",
      x: 0.64,
      y: 0.04,
      dy: 0.01,
      weight: 14,
    },
    {
      selector: "#offres .card",
      x: 0.5,
      y: 0.5,
      dy: 0.42,
      weight: 16,
      count: 3,
      axis: "x",
    },
    { selector: "#avis .carousel-next", x: 0.9, y: 0.6, dy: 0.66, weight: 5 },
    { selector: "footer a.phone", x: 0.2, y: 0.88, dy: 0.97, weight: 6 },
  ],
  simulator: [
    {
      selector: "#simulator .orientation button",
      x: 0.5,
      y: 0.42,
      dy: 0.28,
      weight: 26,
      count: 4,
      axis: "x",
    },
    {
      selector: "#simulator input[name=consumption]",
      x: 0.5,
      y: 0.58,
      dy: 0.4,
      weight: 14,
    },
    {
      selector: "#simulator button.submit",
      x: 0.5,
      y: 0.78,
      dy: 0.55,
      weight: 22,
    },
    { selector: "#result a.cta-quote", x: 0.36, y: 0.62, dy: 0.82, weight: 18 },
    {
      selector: "#result a.cta-callback",
      x: 0.64,
      y: 0.62,
      dy: 0.82,
      weight: 6,
    },
  ],
  quote: [
    {
      selector: "#quote-form input[name=postcode]",
      x: 0.42,
      y: 0.38,
      dy: 0.3,
      weight: 14,
    },
    {
      selector: "#quote-form .interest label",
      x: 0.5,
      y: 0.52,
      dy: 0.45,
      weight: 16,
      count: 4,
      axis: "y",
    },
    {
      selector: "#quote-form button.submit",
      x: 0.5,
      y: 0.82,
      dy: 0.78,
      weight: 20,
    },
  ],
  offer: [
    { selector: "#offer a.cta", x: 0.32, y: 0.6, dy: 0.18, weight: 30 },
    {
      selector: "#offer-faq summary",
      x: 0.5,
      y: 0.5,
      dy: 0.7,
      weight: 14,
      count: 5,
      axis: "y",
    },
    { selector: "#offer .conditions a", x: 0.5, y: 0.86, dy: 0.92, weight: 3 },
  ],
  pv: [
    { selector: "#intro a.btn-primary", x: 0.32, y: 0.6, dy: 0.14, weight: 20 },
    {
      selector: "#gamme .product-card",
      x: 0.5,
      y: 0.5,
      dy: 0.5,
      weight: 12,
      count: 3,
      axis: "x",
    },
  ],
};

/** The A/B split the simulator page runs: the result screen's call to action. */
export const SIMULATOR_EXPERIMENT = "simulator-result-cta";
/** The finished test on the contact form's length. */
export const CONTACT_EXPERIMENT = "contact-form-length";

/** When the simulator test started and the contact test ran, in days before now. */
export const SIMULATOR_TEST_DAYS = 35;
export const CONTACT_TEST_DAYS = { start: 70, stop: 42 } as const;

/** The site's funnels, dated from the boot that first declares them. */
export function helioFunnels(now: number): MarketingFunnelDeclaration[] {
  const at = (days: number) => new Date(now - days * DAY_MS).toISOString();
  return [
    {
      tenantId: DEFAULT_TENANT_ID,
      id: "helio-quote-request",
      websiteId: WEBSITE_ID,
      name: "Demande de devis",
      steps: [
        { kind: "url", value: PAGES.simulator[0] },
        { kind: "custom", value: "simulator_completed" },
        { kind: "url", value: PAGES.quote[0] },
        { kind: "custom", value: "quote_requested" },
      ],
      conversionWindowHours: 24,
      experiment: {
        key: SIMULATOR_EXPERIMENT,
        status: "running",
        startedAt: at(SIMULATOR_TEST_DAYS),
        variations: [
          { key: "control", weight: 1 },
          { key: "instant-estimate", weight: 1 },
        ],
      },
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      id: "helio-autumn-battery",
      websiteId: WEBSITE_ID,
      name: "Offre d'automne batterie",
      steps: [
        { kind: "url", value: PAGES.offer[0] },
        { kind: "custom", value: "battery_offer_cta" },
        { kind: "url", value: PAGES.quote[0] },
        { kind: "custom", value: "quote_requested" },
      ],
      conversionWindowHours: 24,
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      id: "helio-callback",
      websiteId: WEBSITE_ID,
      name: "Demande de rappel",
      steps: [
        { kind: "url", value: PAGES.contact[0] },
        { kind: "custom", value: "callback_requested" },
      ],
      conversionWindowHours: 2,
      experiment: {
        key: CONTACT_EXPERIMENT,
        status: "stopped",
        startedAt: at(CONTACT_TEST_DAYS.start),
        stoppedAt: at(CONTACT_TEST_DAYS.stop),
        variations: [
          { key: "control", weight: 1 },
          { key: "short-form", weight: 1 },
        ],
      },
    },
  ];
}
