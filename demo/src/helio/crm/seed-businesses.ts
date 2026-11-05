export interface BusinessSeed {
  name: string;
  contactName: string;
  city: string;
  segments: readonly string[];
  /** Domain of the website and the contact address. */
  domain: string;
  isVip?: boolean;
  notes: string;
}

/**
 * The business customers of the CRM fixtures, written out by hand so the
 * companies read like a real installer's portfolio.
 */
export const BUSINESSES: readonly BusinessSeed[] = [
  {
    name: "Boulangerie Lejeune SRL",
    contactName: "Marc Lejeune",
    city: "Herstal",
    segments: ["commerce", "photovoltaïque"],
    domain: "boulangerie-lejeune.be",
    notes:
      "Fours électriques : forte consommation tôt le matin, intéressé par une batterie.",
  },
  {
    name: "Ferme du Try-Bara",
    contactName: "Benoît Collignon",
    city: "Ciney",
    segments: ["agriculture", "photovoltaïque"],
    domain: "fermedutrybara.be",
    isVip: true,
    notes: "Hangar de 900 m² orienté sud. Deuxième phase prévue sur l'étable.",
  },
  {
    name: "Garage Delvaux SA",
    contactName: "Philippe Delvaux",
    city: "Seraing",
    segments: ["commerce", "borne"],
    domain: "garage-delvaux.be",
    notes:
      "Concession automobile : bornes pour la clientèle et le parc de démonstration.",
  },
  {
    name: "Brasserie de l'Ourthe SRL",
    contactName: "Céline Hautot",
    city: "Esneux",
    segments: ["horeca", "photovoltaïque"],
    domain: "brasserie-ourthe.be",
    notes: "Groupe froid permanent, consommation stable toute l'année.",
  },
  {
    name: "Clinique vétérinaire des Fagnes",
    contactName: "Anne Mathieu",
    city: "Spa",
    segments: ["commerce", "entretien"],
    domain: "veto-fagnes.be",
    notes: "Contrat d'entretien annuel, très attentive au suivi de production.",
  },
  {
    name: "Transports Gilson & Fils SA",
    contactName: "Didier Gilson",
    city: "Grâce-Hollogne",
    segments: ["industrie", "borne", "photovoltaïque"],
    domain: "gilson-transports.be",
    isVip: true,
    notes:
      "Électrification progressive de la flotte de camionnettes. Décision au conseil d'administration.",
  },
  {
    name: "ACP Résidence Les Tilleuls",
    contactName: "Michel Fontaine",
    city: "Namur",
    segments: ["copropriété", "photovoltaïque"],
    domain: "syndic-fontaine.be",
    notes: "Copropriété de 24 lots, vote en assemblée générale de juin.",
  },
  {
    name: "Menuiserie Lambotte SRL",
    contactName: "Jean-Luc Lambotte",
    city: "Gembloux",
    segments: ["industrie", "photovoltaïque"],
    domain: "menuiserie-lambotte.be",
    notes: "Atelier avec machines triphasées, toiture en bac acier.",
  },
  {
    name: "Hôtel du Val d'Amblève SA",
    contactName: "Sarah Rensonnet",
    city: "Spa",
    segments: ["horeca", "borne"],
    domain: "val-ambleve.be",
    notes:
      "Souhaite des bornes pour la clientèle et un affichage de la production à l'accueil.",
  },
  {
    name: "Pharmacie Centrale de Huy",
    contactName: "Isabelle Dethier",
    city: "Huy",
    segments: ["commerce"],
    domain: "pharmacie-centrale-huy.be",
    notes: "Petite toiture plate, budget serré.",
  },
  {
    name: "Carrières du Condroz SA",
    contactName: "Olivier Piron",
    city: "Dinant",
    segments: ["industrie", "photovoltaïque"],
    domain: "carrieres-condroz.be",
    isVip: true,
    notes: "Projet au sol sur un ancien terril, permis d'urbanisme en cours.",
  },
  {
    name: "Maison Godart, épicerie fine",
    contactName: "Hélène Godart",
    city: "Jambes",
    segments: ["commerce"],
    domain: "maison-godart.be",
    notes: "Vitrines réfrigérées, ouverte sept jours sur sept.",
  },
  {
    name: "École Saint-Joseph ASBL",
    contactName: "Véronique Lecomte",
    city: "Waremme",
    segments: ["photovoltaïque", "prime"],
    domain: "saintjoseph-waremme.be",
    notes: "Dossier de subside UREBA à constituer.",
  },
  {
    name: "Logistique Meuse Services SA",
    contactName: "Thierry Hansen",
    city: "Flémalle",
    segments: ["industrie", "borne", "photovoltaïque"],
    domain: "meuse-logistique.be",
    isVip: true,
    notes:
      "Entrepôt de 6 000 m², toiture récente. Interlocuteur exigeant sur les délais.",
  },
  {
    name: "Arcadia Architectes SRL",
    contactName: "Laurent Wéry",
    city: "Ixelles",
    segments: ["photovoltaïque"],
    domain: "arcadia-archi.be",
    notes: "Prescripteur : recommande Helio à ses clients particuliers.",
  },
  {
    name: "Fromagerie du Gros Chêne",
    contactName: "Hélène Massart",
    city: "Marche-en-Famenne",
    segments: ["agriculture", "photovoltaïque"],
    domain: "groschene.be",
    notes: "Chambre froide et pasteurisateur, consommation en journée.",
  },
  {
    name: "Imprimerie Duchêne SA",
    contactName: "Pascal Duchêne",
    city: "Charleroi",
    segments: ["industrie", "photovoltaïque"],
    domain: "imprimerie-duchene.be",
    isVip: true,
    notes: "Presses offset très énergivores, veut un monitoring détaillé.",
  },
  {
    name: "Centre sportif Mosan ASBL",
    contactName: "Grégory Thiry",
    city: "Ans",
    segments: ["photovoltaïque", "prime"],
    domain: "csmosan.be",
    notes: "Piscine et éclairage du terrain : gros talon de consommation.",
  },
  {
    name: "Boucherie Remacle",
    contactName: "Sébastien Remacle",
    city: "Bastogne",
    segments: ["commerce"],
    domain: "boucherie-remacle.be",
    notes: "Laboratoire de découpe réfrigéré.",
  },
  {
    name: "Data Liège Hosting SA",
    contactName: "Nathalie Gérard",
    city: "Liège",
    segments: ["industrie", "batterie", "photovoltaïque"],
    domain: "dataliege.be",
    isVip: true,
    notes:
      "Salle serveurs : intéressée par le stockage pour l'écrêtage des pointes.",
  },
];
