import type { LibraryDocument } from "./contracts";

const WORK_AT_HEIGHT: LibraryDocument = {
  slug: "work-at-height",
  fileName: "Procédure - travail en hauteur sur toiture.pdf",
  spec: {
    label: "Procédure sécurité",
    title: "Travail en hauteur sur toiture",
    subtitle: "À relire par chaque équipe avant le premier jour de chantier.",
    reference: "SEC-01 · v3",
    blocks: [
      { kind: "heading", text: "Avant de monter" },
      {
        kind: "bullets",
        checkbox: true,
        items: [
          "Météo vérifiée : pas de pluie annoncée, vent inférieur à 50 km/h, pas de gel sur la couverture.",
          "Échafaudage réceptionné ou ligne de vie posée, points d'ancrage contrôlés.",
          "Harnais, longe double et casque à jugulaire inspectés (date de contrôle valide).",
          "Zone de chute balisée au sol, accès du public interdit.",
        ],
      },
      { kind: "heading", text: "Sur la toiture" },
      {
        kind: "bullets",
        items: [
          "Toujours rester attaché : un point d'ancrage au moins à tout moment.",
          "Ne jamais marcher sur les modules ni sur les tuiles faîtières.",
          "Monter les modules au monte-matériaux, jamais à l'échelle.",
          "Deux personnes minimum sur le toit, une troisième au sol en contact visuel.",
        ],
      },
      {
        kind: "note",
        text: "Arrêt immédiat du chantier en cas de doute : le chef d'équipe décide, la planification est adaptée sans pénalité.",
      },
    ],
  },
};

const ISOLATION: LibraryDocument = {
  slug: "electrical-isolation",
  fileName: "Consignation électrique des installations PV.pdf",
  spec: {
    label: "Procédure sécurité",
    title: "Consignation électrique d'une installation photovoltaïque",
    subtitle:
      "Avant toute intervention sur un onduleur, un coffret ou le câblage DC.",
    reference: "SEC-02 · v2",
    blocks: [
      {
        kind: "paragraph",
        text: "Un champ photovoltaïque reste sous tension tant qu'il reçoit de la lumière : couper le réseau ne suffit pas. La consignation suit toujours l'ordre ci-dessous.",
      },
      {
        kind: "bullets",
        checkbox: true,
        items: [
          "1. Couper le disjoncteur AC de l'onduleur au tableau et le cadenasser.",
          "2. Ouvrir le sectionneur DC et attendre cinq minutes la décharge des condensateurs.",
          "3. Vérifier l'absence de tension AC et DC au multimètre catégorie III.",
          "4. Batterie : arrêter le BMS puis ouvrir le disjoncteur batterie.",
          "5. Poser la pancarte « Travaux en cours, ne pas manœuvrer » et noter l'heure.",
        ],
      },
      {
        kind: "note",
        text: "Remise sous tension dans l'ordre inverse, par la même personne, après avoir prévenu le client.",
      },
    ],
  },
};

const COMMISSIONING: LibraryDocument = {
  slug: "commissioning-checklist",
  fileName: "Checklist de mise en service.pdf",
  spec: {
    label: "Checklist",
    title: "Mise en service d'une installation",
    subtitle: "À compléter sur place et à joindre au dossier du chantier.",
    reference: "OPS-04 · v5",
    blocks: [
      { kind: "heading", text: "Installation" },
      {
        kind: "bullets",
        checkbox: true,
        items: [
          "Tensions de chaîne mesurées et notées, cohérentes entre chaînes.",
          "Résistance d'isolement supérieure à 1 mégohm sur chaque chaîne.",
          "Onduleur configuré selon Synergrid C10/11, paramètres de découplage vérifiés.",
          "Batterie enregistrée et testée en charge et en décharge.",
        ],
      },
      { kind: "heading", text: "Client et dossier" },
      {
        kind: "bullets",
        checkbox: true,
        items: [
          "Monitoring Helio activé, site visible dans le parc avec sa puissance crête.",
          "Rapport de contrôle RGIE signé par l'organisme agréé.",
          "Déclaration de l'installation au gestionnaire de réseau envoyée.",
          "Fonctionnement expliqué au client, application installée sur son téléphone.",
          "Photos avant, pendant et après déposées dans la médiathèque du chantier.",
        ],
      },
    ],
  },
};

const BATTERY_FIRE: LibraryDocument = {
  slug: "battery-fire",
  fileName: "Fiche réflexe - incident batterie lithium.pdf",
  spec: {
    label: "Fiche réflexe",
    title: "Incident sur une batterie lithium",
    subtitle: "Échauffement, odeur, fumée ou alarme du BMS.",
    reference: "SEC-05 · v1",
    blocks: [
      {
        kind: "bullets",
        items: [
          "Évacuer les occupants et s'éloigner : ne jamais tenter de déplacer la batterie.",
          "Appeler le 112 en précisant « batterie lithium fer phosphate de X kWh ».",
          "Couper l'installation depuis le tableau si cela peut se faire sans risque.",
          "Prévenir le responsable technique Helio, puis le client et son assureur.",
        ],
      },
      {
        kind: "note",
        text: "Une batterie ayant subi un choc, une inondation ou un échauffement n'est jamais remise en service sans l'accord écrit du fabricant.",
      },
    ],
  },
};

const TRAINING_PLAN: LibraryDocument = {
  slug: "training-plan",
  fileName: "Plan de formation 2026.pdf",
  spec: {
    label: "Ressources humaines",
    title: "Plan de formation 2026",
    subtitle:
      "Formations obligatoires et continues de l'équipe technique et commerciale.",
    reference: "RH-2026",
    blocks: [
      {
        kind: "specs",
        rows: [
          [
            "Janvier",
            "Recyclage travail en hauteur · toute l'équipe technique",
          ],
          [
            "Février",
            "BA4/BA5 habilitation électrique · Elise Lemaire, Antoine Collard",
          ],
          [
            "Mars",
            "Batteries haute tension LFP (fabricant) · Kevin Wouters, Mehdi Benali",
          ],
          ["Mai", "Premiers secours en entreprise · Laura Simon, Nadia Haddad"],
          [
            "Juin",
            "Renouvellement certification photovoltaïque · Julien Peeters",
          ],
          ["Septembre", "Bornes de recharge et OCPP · Antoine Collard"],
          [
            "Octobre",
            "Vente conseil : primes et tarif prosumer · Thomas Renard, Camille Dubois, Nicolas Martens",
          ],
          [
            "Novembre",
            "Exercice d'évacuation et extincteurs · tout le personnel",
          ],
        ],
      },
      {
        kind: "paragraph",
        text: "Les attestations sont classées dans le dossier de chaque membre de l'équipe ; les habilitations arrivant à échéance sont signalées trois mois à l'avance.",
      },
    ],
  },
};

/**
 * Every document of the "Training & safety" folder: the safety procedures and
 * training material of the technicians, which a crew reads before working on a
 * roof, isolating an array, commissioning an installation or facing a battery
 * incident, and the year's training plan.
 */
export const TRAINING_DOCUMENTS: readonly LibraryDocument[] = [
  WORK_AT_HEIGHT,
  ISOLATION,
  COMMISSIONING,
  BATTERY_FIRE,
  TRAINING_PLAN,
];
