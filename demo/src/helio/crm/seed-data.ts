import type { DealStage } from "./database";

export interface Locality {
  city: string;
  postalCode: string;
  province: string;
  streets: readonly string[];
}

/**
 * Real Walloon and Brussels localities with their postcodes, the raw material
 * of the CRM fixtures' addresses.
 */
export const LOCALITIES: readonly Locality[] = [
  {
    city: "Liège",
    postalCode: "4000",
    province: "Liège",
    streets: [
      "Rue Saint-Gilles",
      "Boulevard de la Sauvenière",
      "Rue Hors-Château",
      "Quai de Rome",
    ],
  },
  {
    city: "Herstal",
    postalCode: "4040",
    province: "Liège",
    streets: ["Rue Large Voie", "Rue Hoyoux", "Rue Émile Muraille"],
  },
  {
    city: "Seraing",
    postalCode: "4100",
    province: "Liège",
    streets: ["Rue Cockerill", "Avenue du Ban", "Rue de la Station"],
  },
  {
    city: "Ans",
    postalCode: "4430",
    province: "Liège",
    streets: ["Rue de l'Yser", "Rue Walthère Jamar", "Rue des Français"],
  },
  {
    city: "Grâce-Hollogne",
    postalCode: "4460",
    province: "Liège",
    streets: ["Rue de Loncin", "Rue Grande", "Rue de l'Aéroport"],
  },
  {
    city: "Flémalle",
    postalCode: "4400",
    province: "Liège",
    streets: ["Grand-Route", "Rue de la Gare", "Rue des Écoles"],
  },
  {
    city: "Chaudfontaine",
    postalCode: "4050",
    province: "Liège",
    streets: ["Avenue des Thermes", "Rue de la Station"],
  },
  {
    city: "Esneux",
    postalCode: "4130",
    province: "Liège",
    streets: ["Avenue de la Station", "Rue de Hony", "Rue du Gravier"],
  },
  {
    city: "Huy",
    postalCode: "4500",
    province: "Liège",
    streets: ["Quai de Namur", "Rue Griange", "Avenue des Ardennes"],
  },
  {
    city: "Waremme",
    postalCode: "4300",
    province: "Liège",
    streets: ["Rue de Huy", "Avenue Reine Astrid", "Rue Joseph Wauters"],
  },
  {
    city: "Verviers",
    postalCode: "4800",
    province: "Liège",
    streets: ["Rue de Heusy", "Rue du Collège", "Avenue de Spa"],
  },
  {
    city: "Spa",
    postalCode: "4900",
    province: "Liège",
    streets: ["Avenue Reine Astrid", "Rue Royale", "Boulevard des Anglais"],
  },
  {
    city: "Namur",
    postalCode: "5000",
    province: "Namur",
    streets: ["Rue de Fer", "Boulevard Cauchy", "Rue des Brasseurs"],
  },
  {
    city: "Jambes",
    postalCode: "5100",
    province: "Namur",
    streets: ["Avenue Jean Materne", "Rue de Dave", "Chaussée de Liège"],
  },
  {
    city: "Gembloux",
    postalCode: "5030",
    province: "Namur",
    streets: ["Chaussée de Namur", "Rue du Moulin", "Avenue de la Faculté"],
  },
  {
    city: "Dinant",
    postalCode: "5500",
    province: "Namur",
    streets: ["Rue Grande", "Boulevard Sasserath", "Rue Saint-Jacques"],
  },
  {
    city: "Ciney",
    postalCode: "5590",
    province: "Namur",
    streets: ["Rue du Commerce", "Rue Edouard Dinot", "Chaussée de Namur"],
  },
  {
    city: "Charleroi",
    postalCode: "6000",
    province: "Hainaut",
    streets: ["Boulevard Tirou", "Rue de la Montagne", "Quai de Brabant"],
  },
  {
    city: "Mons",
    postalCode: "7000",
    province: "Hainaut",
    streets: ["Rue de Nimy", "Grand-Rue", "Avenue de l'Hôpital"],
  },
  {
    city: "Tournai",
    postalCode: "7500",
    province: "Hainaut",
    streets: ["Rue Royale", "Quai Notre-Dame", "Rue de la Tête d'Or"],
  },
  {
    city: "La Louvière",
    postalCode: "7100",
    province: "Hainaut",
    streets: ["Rue Albert Ier", "Rue Kéramis", "Avenue Gambetta"],
  },
  {
    city: "Arlon",
    postalCode: "6700",
    province: "Luxembourg",
    streets: ["Grand-Rue", "Avenue de Longwy", "Rue des Faubourgs"],
  },
  {
    city: "Marche-en-Famenne",
    postalCode: "6900",
    province: "Luxembourg",
    streets: ["Rue du Commerce", "Chaussée de Liège", "Rue Porte Haute"],
  },
  {
    city: "Bastogne",
    postalCode: "6600",
    province: "Luxembourg",
    streets: ["Place McAuliffe", "Rue du Sablon", "Route de Marche"],
  },
  {
    city: "Wavre",
    postalCode: "1300",
    province: "Brabant wallon",
    streets: [
      "Rue de Bruxelles",
      "Chaussée de Louvain",
      "Rue du Pont du Christ",
    ],
  },
  {
    city: "Ottignies-Louvain-la-Neuve",
    postalCode: "1340",
    province: "Brabant wallon",
    streets: [
      "Avenue des Combattants",
      "Rue de l'Invasion",
      "Boulevard de Lauzelle",
    ],
  },
  {
    city: "Nivelles",
    postalCode: "1400",
    province: "Brabant wallon",
    streets: ["Rue de Namur", "Faubourg de Mons", "Boulevard des Arbalétriers"],
  },
  {
    city: "Bruxelles",
    postalCode: "1000",
    province: "Bruxelles-Capitale",
    streets: ["Rue Haute", "Boulevard Anspach", "Rue de Flandre"],
  },
  {
    city: "Ixelles",
    postalCode: "1050",
    province: "Bruxelles-Capitale",
    streets: ["Chaussée d'Ixelles", "Rue du Bailli", "Avenue Louise"],
  },
  {
    city: "Uccle",
    postalCode: "1180",
    province: "Bruxelles-Capitale",
    streets: ["Chaussée de Waterloo", "Avenue Brugmann", "Rue Vanderkindere"],
  },
  {
    city: "Etterbeek",
    postalCode: "1040",
    province: "Bruxelles-Capitale",
    streets: ["Avenue d'Auderghem", "Rue des Champs", "Avenue de Tervueren"],
  },
  {
    city: "Woluwe-Saint-Lambert",
    postalCode: "1200",
    province: "Bruxelles-Capitale",
    streets: ["Avenue Georges Henri", "Rue Voot", "Boulevard Brand Whitlock"],
  },
  {
    city: "Schaerbeek",
    postalCode: "1030",
    province: "Bruxelles-Capitale",
    streets: [
      "Avenue Louis Bertrand",
      "Rue Royale Sainte-Marie",
      "Chaussée de Haecht",
    ],
  },
];

/** Index into LOCALITIES by city name, for the hand-written businesses. */
export function localityIndex(city: string): number {
  const index = LOCALITIES.findIndex((locality) => locality.city === city);
  if (index < 0) throw new Error(`Unknown locality ${city}`);
  return index;
}

export const FIRST_NAMES = [
  "Marie",
  "Jean",
  "Nathalie",
  "Philippe",
  "Isabelle",
  "Michel",
  "Catherine",
  "Christophe",
  "Valérie",
  "Olivier",
  "Sandrine",
  "Frédéric",
  "Anne",
  "Pierre",
  "Martine",
  "Laurent",
  "Sophie",
  "Benoît",
  "Caroline",
  "Stéphane",
  "Julie",
  "Damien",
  "Aurélie",
  "Grégory",
  "Émilie",
  "Sébastien",
  "Charlotte",
  "Maxime",
  "Pauline",
  "Arnaud",
];

export const LAST_NAMES = [
  "Dupont",
  "Lambert",
  "Dubois",
  "Martin",
  "Simon",
  "Laurent",
  "Lejeune",
  "Leclercq",
  "Renard",
  "Hennen",
  "Goffin",
  "Collard",
  "Jacquet",
  "Gilson",
  "Thiry",
  "Pirard",
  "Lemaire",
  "Mathieu",
  "Dethier",
  "Henrard",
  "Lambotte",
  "Remacle",
  "Close",
  "Detry",
  "Wuidar",
  "Halleux",
  "Bastin",
  "Lhoest",
  "Delvaux",
  "Graindorge",
];

/**
 * Reserved example domains only (RFC 2606), so a real mail server configured on
 * the demo can never reach a real person.
 */
export const MAIL_DOMAINS = [
  "mail.example",
  "courriel.example",
  "example.be",
  "boite.example",
  "example.com",
  "webmail.example",
];

export const RESIDENTIAL_NOTES = [
  "<p>Maison quatre façades, toiture sud-ouest. Souhaite une batterie à terme.</p>",
  "<p>A une pompe à chaleur : dimensionner large.</p>",
  "<p>Voiture électrique commandée, intéressé par une borne.</p>",
  "<p>Toiture en ardoises, préfère des panneaux full black.</p>",
  "<p>Compteur bidirectionnel déjà installé.</p>",
  "<p>Ombrage partiel le matin (grand chêne côté est).</p>",
];

/** What a sales rep plans next on a deal, by stage. */
export const NEXT_STEPS: Record<DealStage, readonly string[]> = {
  lead: [
    "Premier appel de qualification",
    "Envoyer la brochure et une simulation",
    "Rappeler après les congés",
  ],
  qualified: [
    "Planifier la visite technique",
    "Récupérer les factures d'électricité",
    "Vérifier l'orientation de la toiture",
  ],
  site_visit: [
    "Visite technique à confirmer",
    "Rédiger le rapport de visite",
    "Contrôler la charpente",
  ],
  proposal: [
    "Envoyer l'offre",
    "Relancer sur l'offre envoyée",
    "Présenter l'offre au gérant",
  ],
  negotiation: [
    "Revoir la remise sur la batterie",
    "Attendre l'accord de la banque",
    "Valider l'échéancier de paiement",
    "Faire signer le bon de commande",
  ],
  won: ["Transmis à la planification", "Planifier le chantier"],
  lost: [],
};
