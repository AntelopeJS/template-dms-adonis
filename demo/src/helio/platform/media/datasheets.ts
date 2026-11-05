import {
  PRODUCT_CATEGORY_ROSTER,
  PRODUCT_ROSTER,
  type ProductRosterEntry,
} from "../../shared/roster";
import type { DocBlock, DocSpec } from "./pdf-layout";

export type HardwareFamily =
  | "cat-panels"
  | "cat-inverters"
  | "cat-storage"
  | "cat-ev";

export interface Datasheet {
  product: ProductRosterEntry;
  family: HardwareFamily;
  fileName: string;
  spec: DocSpec;
}

export const HARDWARE_FAMILIES: readonly HardwareFamily[] = [
  "cat-panels",
  "cat-inverters",
  "cat-storage",
  "cat-ev",
];

const fr = (value: number, digits = 0) =>
  value.toLocaleString("fr-BE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function familyOf(product: ProductRosterEntry): HardwareFamily | undefined {
  const leaf = PRODUCT_CATEGORY_ROSTER.find((c) => c.id === product.category);
  return HARDWARE_FAMILIES.find((family) => family === leaf?.parent);
}

function panelBlocks(p: ProductRosterEntry): DocBlock[] {
  const bifacial = p.category === "cat-panels-bifacial";
  const area = bifacial ? 2.58 : 1.95;
  const efficiency = (p.power / (area * 1000)) * 100;
  const vmp = bifacial ? 41.6 : 31.8;
  return [
    {
      kind: "paragraph",
      text: `Module ${bifacial ? "bifacial verre-verre" : "monocristallin"} à cellules N-type TOPCon demi-coupées, conçu pour les toitures belges : faible dégradation, bon comportement par temps couvert et cadre renforcé pour les charges de neige et de vent.`,
    },
    { kind: "heading", text: "Caractéristiques électriques (STC)" },
    {
      kind: "specs",
      rows: [
        ["Puissance crête", `${p.power} Wc (tolérance 0/+5 W)`],
        ["Rendement du module", `${fr(efficiency, 1)} %`],
        ["Tension au point de puissance max.", `${fr(vmp, 1)} V`],
        ["Courant au point de puissance max.", `${fr(p.power / vmp, 2)} A`],
        ["Tension en circuit ouvert", `${fr(vmp * 1.19, 1)} V`],
        ["Coefficient de température (Pmax)", "-0,29 %/°C"],
        ...(bifacial ? [["Bifacialité", "80 % ± 5 %"] as const] : []),
      ],
    },
    { kind: "heading", text: "Caractéristiques mécaniques" },
    {
      kind: "specs",
      rows: [
        [
          "Dimensions",
          bifacial ? "2 278 × 1 134 × 30 mm" : "1 722 × 1 134 × 30 mm",
        ],
        ["Poids", bifacial ? "32,5 kg" : "21,8 kg"],
        ["Charge de neige / de vent", "5 400 Pa / 2 400 Pa"],
        ["Boîte de jonction", "IP68, 3 diodes bypass, connecteurs MC4"],
      ],
    },
    { kind: "heading", text: "Garanties et certifications" },
    {
      kind: "bullets",
      items: [
        "Garantie produit de 25 ans, garantie de performance de 30 ans (87,4 % de la puissance initiale).",
        "Certifié IEC 61215 et IEC 61730, résistance au brouillard salin et à l'ammoniac.",
        "Éligible aux installations déclarées au gestionnaire de réseau (Synergrid C10/11).",
      ],
    },
  ];
}

function inverterBlocks(p: ProductRosterEntry): DocBlock[] {
  const hybrid = p.category === "cat-inverters-hybrid";
  const micro = p.category === "cat-inverters-micro";
  const kw = p.power / 1000;
  const threePhase = kw >= 10;
  return [
    {
      kind: "paragraph",
      text: micro
        ? "Micro-onduleur double entrée pour deux modules, idéal pour les toitures ombragées ou multi-orientées : chaque panneau produit indépendamment et se suit dans l'application Helio."
        : `Onduleur ${hybrid ? "hybride prêt pour une batterie domestique" : "string"} ${threePhase ? "triphasé" : "monophasé"}, silencieux et sans ventilateur, raccordé à la plateforme de monitoring Helio.`,
    },
    { kind: "heading", text: "Caractéristiques" },
    {
      kind: "specs",
      rows: [
        ["Puissance nominale AC", `${fr(kw, kw < 1 ? 1 : 0)} kW`],
        ["Puissance PV max. conseillée", `${fr(kw * 1.5, 1)} kWc`],
        ["Trackers MPPT", micro ? "2 (un par module)" : "2"],
        ["Plage de tension MPPT", micro ? "16 – 60 V" : "160 – 950 V"],
        [
          "Rendement maximal / européen",
          micro ? "96,7 % / 96,5 %" : "98,4 % / 97,8 %",
        ],
        [
          "Raccordement réseau",
          threePhase ? "Triphasé 3N~ 400 V" : "Monophasé 230 V",
        ],
        ["Indice de protection", micro ? "IP67" : "IP66"],
        [
          "Communication",
          hybrid
            ? "Wi-Fi, Ethernet, RS485, port batterie CAN"
            : "Wi-Fi, Ethernet, Modbus TCP",
        ],
        ...(hybrid
          ? [
              [
                "Batteries compatibles",
                "Helio 5, 10 et 15 kWh (LFP haute tension)",
              ] as const,
            ]
          : []),
      ],
    },
    { kind: "heading", text: "Conformité et garantie" },
    {
      kind: "bullets",
      items: [
        "Conforme à la prescription Synergrid C10/11 et au RGIE ; protection de découplage intégrée.",
        `Garantie de ${micro ? "20" : "10"} ans, extensible par le contrat de maintenance Helio.`,
        "Mise à jour du firmware à distance et alertes de production dans le monitoring Helio.",
      ],
    },
  ];
}

function batteryBlocks(p: ProductRosterEntry): DocBlock[] {
  const kwh = p.power / 1000;
  const modules = kwh / 5;
  return [
    {
      kind: "paragraph",
      text: "Batterie domestique lithium fer phosphate (LFP), modulaire par blocs de 5 kWh : elle stocke la production de la journée pour la soirée et réduit la part payée au tarif prosumer.",
    },
    { kind: "heading", text: "Caractéristiques" },
    {
      kind: "specs",
      rows: [
        ["Capacité utile", `${fr(kwh * 0.95, 2)} kWh (${fr(kwh)} kWh nominal)`],
        [
          "Puissance de charge / décharge",
          `${fr(Math.min(kwh * 0.5, 7.5), 1)} kW continue`,
        ],
        ["Chimie", "LFP, sans cobalt"],
        ["Profondeur de décharge", "95 %"],
        ["Cycles garantis", "6 000 cycles à 90 % DoD"],
        ["Modules", `${modules} × 5 kWh, extensible jusqu'à 15 kWh`],
        ["Dimensions", `600 × 190 × ${fr(220 + modules * 330)} mm`],
        ["Poids", `${fr(18 + modules * 46)} kg`],
        ["Installation", "Intérieure ou abritée, IP55, -10 à +50 °C"],
      ],
    },
    { kind: "heading", text: "Sécurité et garantie" },
    {
      kind: "bullets",
      items: [
        "Système de gestion (BMS) avec surveillance cellule par cellule et coupure automatique.",
        "Garantie de 10 ans ou 6 000 cycles, capacité résiduelle garantie de 70 %.",
        "Compatible avec les onduleurs hybrides Helio 6 et 10 kW ; fonction secours en option.",
      ],
    },
    {
      kind: "note",
      text: "Installation par un technicien Helio certifié uniquement : la mise en service enregistre la batterie dans le monitoring et active la garantie.",
    },
  ];
}

function chargerBlocks(p: ProductRosterEntry): DocBlock[] {
  const kw = p.power / 1000;
  const business = kw >= 22;
  return [
    {
      kind: "paragraph",
      text: business
        ? "Borne de recharge double usage pour parkings d'entreprise : partage de charge entre bornes, badges RFID par conducteur et refacturation des recharges à domicile."
        : "Borne murale intelligente pour la maison : elle recharge en priorité avec le surplus solaire et se pilote depuis l'application Helio.",
    },
    { kind: "heading", text: "Caractéristiques" },
    {
      kind: "specs",
      rows: [
        [
          "Puissance de charge",
          `${fr(kw, 1)} kW (${kw > 7.4 ? "triphasé 400 V" : "monophasé 230 V"})`,
        ],
        [
          "Connecteur",
          business ? "2 prises Type 2 (T2S)" : "Câble attaché Type 2, 7,5 m",
        ],
        ["Protection", "Détection de courant de fuite DC 6 mA intégrée"],
        [
          "Identification",
          business ? "RFID, application, OCPP 1.6J" : "RFID ou application",
        ],
        ["Pilotage solaire", "Recharge sur surplus via l'onduleur Helio"],
        ["Indice de protection", "IP54, IK10"],
        ["Dimensions", business ? "480 × 330 × 170 mm" : "320 × 250 × 110 mm"],
      ],
    },
    { kind: "heading", text: "Installation et avantages" },
    {
      kind: "bullets",
      items: [
        "Installation et contrôle RGIE par Helio, attestation de conformité fournie.",
        "Garantie de 3 ans pièces et main-d'œuvre.",
        business
          ? "Rapports de consommation par conducteur pour la refacturation des voitures de société."
          : "Compatible avec toutes les voitures électriques et hybrides rechargeables du marché.",
      ],
    },
  ];
}

const BLOCKS: Record<HardwareFamily, (p: ProductRosterEntry) => DocBlock[]> = {
  "cat-panels": panelBlocks,
  "cat-inverters": inverterBlocks,
  "cat-storage": batteryBlocks,
  "cat-ev": chargerBlocks,
};

/**
 * One datasheet per hardware product of the catalog roster. Its figures are
 * derived from the product's rated power, so a sheet always matches the
 * catalog row it documents.
 */
export function buildDatasheets(): Datasheet[] {
  return PRODUCT_ROSTER.flatMap((product): Datasheet[] => {
    const family = familyOf(product);
    if (!family) return [];
    return [
      {
        product,
        family,
        fileName: `Fiche technique ${product.sku} - ${product.name}.pdf`,
        spec: {
          label: "Fiche technique",
          title: product.name,
          subtitle: `Référence ${product.sku} · Prix public conseillé ${fr(product.price)} € HTVA`,
          reference: `${product.sku} · éd. 2026-03`,
          blocks: BLOCKS[family](product),
        },
      },
    ];
  });
}
