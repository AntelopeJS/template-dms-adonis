import type { DocSpec } from "./pdf-layout";

export interface LibraryDocument {
  /** Stable part of the declaration key. */
  slug: string;
  fileName: string;
  spec: DocSpec;
}

/** A signed installation contract, for one of the projects of the demo. */
export interface ContractProject {
  code: string;
  customerName: string;
  city: string;
  capacityKwp: number;
  budget: number;
}

const euros = (amount: number) =>
  `${amount.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const TERMS: LibraryDocument = {
  slug: "general-terms",
  fileName: "Conditions générales de vente 2026.pdf",
  spec: {
    label: "Conditions générales",
    title: "Conditions générales de vente et d'installation",
    subtitle:
      "Applicables à toute offre, commande et prestation de Helio SRL à partir du 1er janvier 2026.",
    reference: "CGV v2026.1",
    blocks: [
      { kind: "heading", text: "1. Offres et commandes" },
      {
        kind: "paragraph",
        text: "Nos devis sont valables trente jours. La commande est ferme à la signature du devis par le client, en ligne sur le portail Helio ou sur papier, et au paiement de l'acompte de 30 %.",
      },
      { kind: "heading", text: "2. Prix et paiement" },
      {
        kind: "paragraph",
        text: "Les prix s'entendent hors TVA. Le taux réduit de 6 % s'applique aux habitations privées de plus de dix ans, sur attestation du client ; à défaut, le taux de 21 % est appliqué. Le solde est payable à trente jours après la réception des travaux.",
      },
      {
        kind: "paragraph",
        text: "Tout montant impayé à l'échéance porte de plein droit un intérêt de retard de 10 % l'an et une indemnité forfaitaire de 40 euros, sans mise en demeure préalable.",
      },
      { kind: "heading", text: "3. Délais et exécution" },
      {
        kind: "paragraph",
        text: "Les délais d'installation sont donnés à titre indicatif et dépendent de la météo, de la disponibilité du matériel et de l'accord de raccordement du gestionnaire de réseau. Les travaux en toiture sont suspendus par vent supérieur à 50 km/h ou toiture humide.",
      },
      { kind: "heading", text: "4. Réception et garanties" },
      {
        kind: "paragraph",
        text: "La réception a lieu à la mise en service, après le contrôle RGIE par un organisme agréé. Les garanties des fabricants s'ajoutent à notre garantie de dix ans sur la main-d'œuvre et l'étanchéité des percements de toiture.",
      },
      { kind: "heading", text: "5. Litiges" },
      {
        kind: "paragraph",
        text: "Le droit belge est seul applicable. En cas de litige, et après une tentative de règlement amiable, les tribunaux de l'arrondissement judiciaire de Liège sont seuls compétents.",
      },
    ],
  },
};

const MAINTENANCE: LibraryDocument = {
  slug: "maintenance-contract",
  fileName: "Contrat de maintenance - modèle.pdf",
  spec: {
    label: "Contrat",
    title: "Contrat de maintenance d'installation photovoltaïque",
    subtitle:
      "Modèle à compléter, remis avec chaque offre d'installation résidentielle.",
    reference: "SRV-MAINT-1Y · v4",
    blocks: [
      { kind: "heading", text: "Parties" },
      {
        kind: "specs",
        rows: [
          [
            "Prestataire",
            "Helio SRL, Rue de l'Énergie 12, 4040 Herstal, TVA BE0742.318.065",
          ],
          ["Client", "Nom, adresse de l'installation et numéro de client"],
          [
            "Installation",
            "Puissance (kWc), onduleur, batterie éventuelle, date de mise en service",
          ],
        ],
      },
      { kind: "heading", text: "Prestations comprises" },
      {
        kind: "bullets",
        items: [
          "Une visite annuelle : contrôle visuel des modules, des fixations et du câblage DC.",
          "Contrôle de l'onduleur, des protections et mise à jour du firmware.",
          "Surveillance de la production dans le monitoring Helio et alerte en cas d'anomalie.",
          "Intervention sous 48 heures ouvrables en cas d'arrêt de production.",
        ],
      },
      { kind: "heading", text: "Prix et durée" },
      {
        kind: "specs",
        rows: [
          ["Redevance", "149,00 € HTVA par an, indexée chaque 1er janvier"],
          ["Nettoyage des modules", "En option : 4,00 € HTVA par module"],
          [
            "Durée",
            "Un an, reconduit tacitement, résiliable trois mois avant l'échéance",
          ],
        ],
      },
      { kind: "signatures", parties: ["Pour Helio SRL", "Le client"] },
    ],
  },
};

const RESCERT: LibraryDocument = {
  slug: "rescert",
  fileName: "Certificat RESCert - installateurs photovoltaïques.pdf",
  spec: {
    label: "Certificat",
    title: "Certification des installateurs photovoltaïques",
    subtitle:
      "Liste des techniciens de Helio SRL titulaires de la certification d'installateur en énergies renouvelables.",
    reference: "Mise à jour 2026-09",
    blocks: [
      {
        kind: "paragraph",
        text: "La certification est exigée pour l'octroi des primes régionales. Elle est renouvelée tous les cinq ans, moyennant une formation continue suivie par chaque technicien.",
      },
      {
        kind: "specs",
        rows: [
          [
            "Julien Peeters",
            "Photovoltaïque et pompes à chaleur · n° PV-2021-04187 · valable jusqu'au 14/03/2031",
          ],
          [
            "Laura Simon",
            "Photovoltaïque · n° PV-2023-06652 · valable jusqu'au 02/10/2028",
          ],
          [
            "Mehdi Benali",
            "Photovoltaïque · n° PV-2022-05510 · valable jusqu'au 21/06/2027",
          ],
          [
            "Kevin Wouters",
            "Photovoltaïque et stockage · n° PV-2024-07034 · valable jusqu'au 09/02/2029",
          ],
          [
            "Elise Lemaire",
            "Photovoltaïque · n° PV-2025-07791 · valable jusqu'au 30/05/2030",
          ],
          [
            "Antoine Collard",
            "Bornes de recharge · n° VE-2024-01128 · valable jusqu'au 17/11/2029",
          ],
        ],
      },
      {
        kind: "note",
        text: "Document interne : la copie des certificats individuels est jointe aux dossiers de prime à la demande du client.",
      },
    ],
  },
};

const INSURANCE: LibraryDocument = {
  slug: "insurance",
  fileName: "Attestation d'assurance RC professionnelle 2026.pdf",
  spec: {
    label: "Attestation",
    title: "Attestation d'assurance responsabilité civile",
    subtitle:
      "Délivrée par Assurances Mosanes SA à la demande de son assurée, Helio SRL.",
    reference: "Police RC-PRO 4471-2209",
    blocks: [
      {
        kind: "paragraph",
        text: "Assurances Mosanes SA atteste que Helio SRL est couverte, pour la période du 1er janvier au 31 décembre 2026, par un contrat d'assurance responsabilité civile exploitation et après travaux pour ses activités d'installation photovoltaïque, de stockage d'énergie et de bornes de recharge.",
      },
      {
        kind: "specs",
        rows: [
          ["Dommages corporels", "2 500 000 € par sinistre"],
          ["Dommages matériels", "1 250 000 € par sinistre"],
          ["Responsabilité après travaux", "1 250 000 € par année d'assurance"],
          ["Travaux en toiture", "Compris, franchise de 500 €"],
          ["Garantie décennale", "Contrat distinct n° DEC-4471-118"],
        ],
      },
      {
        kind: "paragraph",
        text: "La présente attestation ne peut engager l'assureur au-delà des conditions du contrat auquel elle se réfère.",
      },
    ],
  },
};

/** The signed contract of one installation project. */
function projectContract(project: ContractProject): LibraryDocument {
  return {
    slug: `contract-${project.code.toLowerCase()}`,
    fileName: `Contrat d'installation signé - ${project.code}.pdf`,
    spec: {
      label: "Contrat signé",
      title: `Contrat d'installation ${project.code}`,
      subtitle: `${project.customerName}, ${project.city} · centrale de ${project.capacityKwp.toLocaleString("fr-BE")} kWc`,
      reference: project.code,
      blocks: [
        { kind: "heading", text: "Objet" },
        {
          kind: "paragraph",
          text: `Fourniture, pose et mise en service d'une centrale photovoltaïque de ${project.capacityKwp.toLocaleString("fr-BE")} kWc en toiture, raccordée au réseau basse tension, avec le monitoring Helio et le contrôle RGIE.`,
        },
        {
          kind: "specs",
          rows: [
            ["Montant des travaux", `${euros(project.budget)} HTVA`],
            [
              "Acompte à la commande",
              `${euros(project.budget * 0.3)} HTVA (30 %)`,
            ],
            ["Solde", "À trente jours après la réception"],
            ["Conditions", "Conditions générales de vente 2026, jointes"],
          ],
        },
        {
          kind: "signatures",
          parties: ["Pour Helio SRL — Sophie Lambert", project.customerName],
        },
      ],
    },
  };
}

/**
 * Every document of the "Contracts & certificates" folder: the general terms,
 * the maintenance contract template, the installer certifications and the
 * insurance certificate a customer or a network operator asks for, then the
 * signed contract of each project.
 */
export function contractDocuments(
  projects: readonly ContractProject[],
): LibraryDocument[] {
  return [
    TERMS,
    MAINTENANCE,
    RESCERT,
    INSURANCE,
    ...projects.map(projectContract),
  ];
}
