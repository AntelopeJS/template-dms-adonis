import type { TicketCategory } from "./database";

/** The subject line and the first message of a seeded ticket. */
export interface TicketText {
  subject: string;
  description: string;
}

/**
 * What customers write to the service desk, by category: seed data, in French
 * like the customers of a Liège installer.
 */
export const SUBJECTS: Record<TicketCategory, TicketText[]> = {
  no_production: [
    {
      subject: "Plus aucune production depuis ce matin",
      description:
        "L'application affiche 0 kWh alors qu'il fait grand soleil. L'onduleur ne montre aucune lumière.",
    },
    {
      subject: "Production nulle sur une partie des panneaux",
      description:
        "Une des deux chaînes de panneaux ne produit plus depuis l'orage de la semaine dernière.",
    },
    {
      subject: "Installation à l'arrêt après une coupure de courant",
      description:
        "Après la coupure de courant d'hier soir, l'installation ne redémarre pas.",
    },
  ],
  inverter_error: [
    {
      subject: "Code d'erreur sur l'onduleur",
      description:
        "L'onduleur affiche un code d'erreur et une lumière rouge clignote. Faut-il couper le disjoncteur ?",
    },
    {
      subject: "Onduleur qui se coupe en milieu de journée",
      description:
        "L'onduleur se met en défaut plusieurs fois par jour quand la production est forte.",
    },
    {
      subject: "Défaut d'isolement signalé",
      description:
        "Le monitoring remonte un défaut d'isolement depuis deux jours, surtout le matin.",
    },
    {
      subject: "Ventilateur de l'onduleur très bruyant",
      description:
        "L'onduleur installé au garage fait un bruit de ventilation inhabituel depuis quelques jours.",
    },
  ],
  monitoring: [
    {
      subject: "L'application ne se met plus à jour",
      description:
        "Les données de production ne remontent plus dans l'application depuis le changement de box internet.",
    },
    {
      subject: "Accès au portail de monitoring perdu",
      description:
        "Je n'arrive plus à me connecter au portail, le mot de passe est refusé.",
    },
    {
      subject: "Consommation affichée incohérente",
      description:
        "La consommation de la maison affichée dans l'application semble deux fois trop élevée.",
    },
  ],
  damage: [
    {
      subject: "Panneau fissuré après la grêle",
      description:
        "Un panneau présente une fissure visible depuis la rue après l'averse de grêle de dimanche.",
    },
    {
      subject: "Câble arraché par des fouines",
      description:
        "Des câbles sous les panneaux ont été rongés, nous avons retrouvé des traces dans le grenier.",
    },
    {
      subject: "Tuile déplacée près des crochets",
      description:
        "Une tuile a glissé près des fixations, il y a eu une infiltration au plafond de la chambre.",
    },
  ],
  billing: [
    {
      subject: "Question sur la facture d'acompte",
      description:
        "Pouvez-vous me confirmer le taux de TVA appliqué ? Ma maison a plus de dix ans.",
    },
    {
      subject: "Demande de duplicata de facture",
      description:
        "J'ai besoin d'une copie de la facture finale pour ma banque.",
    },
    {
      subject: "Paiement effectué en double",
      description:
        "Il semble que le virement ait été effectué deux fois, merci de vérifier et de rembourser.",
    },
    {
      subject: "Changement d'adresse de facturation",
      description:
        "Notre siège a déménagé, merci de mettre à jour l'adresse pour les prochaines factures.",
    },
  ],
  other: [
    {
      subject: "Demande de nettoyage des panneaux",
      description:
        "Les panneaux sont couverts de mousse côté nord, pouvez-vous proposer un nettoyage ?",
    },
    {
      subject: "Ajout d'une batterie à l'installation",
      description:
        "Nous aimerions ajouter une batterie. Est-ce compatible avec l'onduleur actuel ?",
    },
    {
      subject: "Attestation pour l'assurance habitation",
      description:
        "Mon assureur demande une attestation de conformité de l'installation.",
    },
  ],
};
