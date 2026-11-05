import {
  PRODUCT_CATEGORY_ROSTER,
  PRODUCT_ROSTER,
  type ProductRosterEntry,
} from "../shared/roster";
import { productVisualUrl } from "./visuals";

type Localized = Record<"en" | "fr", string>;

export interface ProductCategorySeed {
  _id: string;
  name: Localized;
  parent?: string;
}

export interface ProductSeed {
  _id: string;
  sku: string;
  name: string;
  description: Localized;
  category: string;
  price: number;
  cost: number;
  /** Absent for a service, so the table shows a dash instead of "0 W / Wh". */
  power?: number;
  unit: ProductRosterEntry["unit"];
  /** Absent for a service: services carry no stock at all. */
  stock?: number;
  /** Absent whenever `stock` is. */
  stockMin?: number;
  /** Drawn by the backend (visuals.ts): no network, same on every machine. */
  image: string;
  tags: string[];
  isActive: boolean;
  displayOrder: number;
  warrantyYears: number;
}

/** The categories of PRODUCT_CATEGORY_ROSTER, as they are. */
export function buildProductCategories(): ProductCategorySeed[] {
  return PRODUCT_CATEGORY_ROSTER.map(({ id, name, parent }) => {
    const category: ProductCategorySeed = { _id: id, name: { ...name } };
    if (parent) category.parent = parent;
    return category;
  });
}

interface ProductDetail {
  description: Localized;
  /** Purchase cost as a share of the price. */
  costRatio: number;
  /** Stock and reorder threshold; services have none. */
  stock?: [number, number];
  tags: string[];
  warrantyYears: number;
  isActive?: boolean;
}

const PANEL = (watts: number, extra: Localized): Localized => ({
  en: `Monocrystalline ${watts} Wp module, 25-year linear performance warranty. ${extra.en}`,
  fr: `Module monocristallin de ${watts} Wc, garantie de performance linéaire de 25 ans. ${extra.fr}`,
});

const DETAILS = new Map(
  Object.entries({
    "prod-01": {
      description: PANEL(410, {
        en: "Best value for pitched roofs.",
        fr: "Le meilleur rapport qualité-prix pour les toitures en pente.",
      }),
      costRatio: 0.62,
      stock: [640, 200],
      tags: ["bestseller", "résidentiel"],
      warrantyYears: 25,
    },
    "prod-02": {
      description: PANEL(430, {
        en: "Full-black finish for slate roofs.",
        fr: "Finition full black, idéale sur ardoises.",
      }),
      costRatio: 0.6,
      stock: [180, 150],
      tags: ["esthétique", "résidentiel"],
      warrantyYears: 25,
    },
    "prod-03": {
      description: PANEL(450, {
        en: "High output for small roofs.",
        fr: "Haut rendement pour les petites toitures.",
      }),
      costRatio: 0.63,
      stock: [95, 120],
      tags: ["résidentiel"],
      warrantyYears: 25,
    },
    "prod-04": {
      description: {
        en: "Bifacial glass-glass 540 Wp module for flat roofs and carports.",
        fr: "Module bifacial verre-verre de 540 Wc pour toits plats et carports.",
      },
      costRatio: 0.64,
      stock: [320, 100],
      tags: ["entreprises", "carport"],
      warrantyYears: 30,
    },
    "prod-05": {
      description: {
        en: "Bifacial 580 Wp module for commercial roofs and ground mounts.",
        fr: "Module bifacial de 580 Wc pour toitures industrielles et installations au sol.",
      },
      costRatio: 0.65,
      stock: [40, 80],
      tags: ["entreprises"],
      warrantyYears: 30,
    },
    "prod-06": {
      description: {
        en: "Single-phase string inverter, 5 kW, Wi-Fi monitoring included.",
        fr: "Onduleur string monophasé de 5 kW, monitoring Wi-Fi inclus.",
      },
      costRatio: 0.68,
      stock: [34, 10],
      tags: ["monophasé"],
      warrantyYears: 10,
    },
    "prod-07": {
      description: {
        en: "Three-phase string inverter, 10 kW, two MPPT trackers.",
        fr: "Onduleur string triphasé de 10 kW, deux trackers MPPT.",
      },
      costRatio: 0.67,
      stock: [12, 8],
      tags: ["triphasé"],
      warrantyYears: 10,
    },
    "prod-08": {
      description: {
        en: "Three-phase 30 kW inverter for SME and farm roofs.",
        fr: "Onduleur triphasé de 30 kW pour PME et exploitations agricoles.",
      },
      costRatio: 0.7,
      stock: [3, 4],
      tags: ["triphasé", "entreprises"],
      warrantyYears: 10,
    },
    "prod-09": {
      description: {
        en: "Hybrid inverter, 6 kW, ready for a home battery.",
        fr: "Onduleur hybride de 6 kW, prêt pour une batterie domestique.",
      },
      costRatio: 0.66,
      stock: [22, 10],
      tags: ["hybride", "batterie"],
      warrantyYears: 10,
    },
    "prod-10": {
      description: {
        en: "Three-phase hybrid inverter, 10 kW, backup output.",
        fr: "Onduleur hybride triphasé de 10 kW, avec sortie de secours.",
      },
      costRatio: 0.66,
      stock: [9, 6],
      tags: ["hybride", "triphasé"],
      warrantyYears: 10,
    },
    "prod-11": {
      description: {
        en: "Micro-inverter for two panels, ideal for shaded roofs.",
        fr: "Micro-onduleur pour deux panneaux, idéal pour les toitures ombragées.",
      },
      costRatio: 0.6,
      stock: [150, 60],
      tags: ["ombrage"],
      warrantyYears: 20,
    },
    "prod-12": {
      description: {
        en: "LFP home battery, 5 kWh, stackable.",
        fr: "Batterie domestique LFP de 5 kWh, empilable.",
      },
      costRatio: 0.7,
      stock: [14, 6],
      tags: ["batterie", "LFP"],
      warrantyYears: 10,
    },
    "prod-13": {
      description: {
        en: "LFP home battery, 10 kWh, the most popular size.",
        fr: "Batterie domestique LFP de 10 kWh, la capacité la plus demandée.",
      },
      costRatio: 0.71,
      stock: [4, 6],
      tags: ["batterie", "LFP", "bestseller"],
      warrantyYears: 10,
    },
    "prod-14": {
      description: {
        en: "LFP home battery, 15 kWh, for heat pumps and EVs.",
        fr: "Batterie domestique LFP de 15 kWh, pour pompes à chaleur et véhicules électriques.",
      },
      costRatio: 0.72,
      stock: [2, 3],
      tags: ["batterie", "LFP"],
      warrantyYears: 10,
    },
    "prod-15": {
      description: {
        en: "Single-phase 7.4 kW wallbox with type 2 cable.",
        fr: "Borne murale monophasée de 7,4 kW avec câble type 2.",
      },
      costRatio: 0.58,
      stock: [26, 8],
      tags: ["borne", "résidentiel"],
      warrantyYears: 3,
    },
    "prod-16": {
      description: {
        en: "Smart 11 kW wallbox, solar surplus charging.",
        fr: "Borne intelligente de 11 kW, recharge sur surplus solaire.",
      },
      costRatio: 0.6,
      stock: [18, 8],
      tags: ["borne", "smart"],
      warrantyYears: 3,
    },
    "prod-17": {
      description: {
        en: "22 kW business charger with RFID and load balancing.",
        fr: "Borne entreprise de 22 kW avec badge RFID et délestage.",
      },
      costRatio: 0.62,
      stock: [5, 4],
      tags: ["borne", "entreprises"],
      warrantyYears: 3,
    },
    "prod-18": {
      description: {
        en: "Turnkey residential installation: mounting, wiring, RGIE inspection.",
        fr: "Installation résidentielle clé en main : pose, câblage, contrôle RGIE.",
      },
      costRatio: 0.45,
      tags: ["service"],
      warrantyYears: 10,
    },
    "prod-19": {
      description: {
        en: "Commercial installation, priced per installed kWp.",
        fr: "Installation commerciale, facturée par kWc installé.",
      },
      costRatio: 0.5,
      tags: ["service", "entreprises"],
      warrantyYears: 10,
    },
    "prod-20": {
      description: {
        en: "On-site roof survey with structural check and shading study.",
        fr: "Visite technique avec contrôle de structure et étude d'ombrage.",
      },
      costRatio: 0.4,
      tags: ["service"],
      warrantyYears: 0,
    },
    "prod-21": {
      description: {
        en: "On-site technician hour, travel included in Wallonia.",
        fr: "Heure de technicien sur site, déplacement inclus en Wallonie.",
      },
      costRatio: 0.55,
      tags: ["service"],
      warrantyYears: 0,
    },
    "prod-22": {
      description: {
        en: "Yearly maintenance: inspection, inverter check, report.",
        fr: "Entretien annuel : inspection, contrôle de l'onduleur, rapport.",
      },
      costRatio: 0.4,
      tags: ["service", "contrat"],
      warrantyYears: 0,
    },
    "prod-23": {
      description: {
        en: "Yearly monitoring subscription with production alerts.",
        fr: "Abonnement annuel au monitoring avec alertes de production.",
      },
      costRatio: 0.25,
      tags: ["service", "contrat"],
      warrantyYears: 0,
    },
    "prod-24": {
      description: {
        en: "Panel cleaning, priced per panel.",
        fr: "Nettoyage des panneaux, facturé par panneau.",
      },
      costRatio: 0.5,
      tags: ["service"],
      warrantyYears: 0,
      isActive: false,
    },
  } satisfies Record<string, ProductDetail>),
);

function familyOf(categoryId: string): string {
  const leaf = PRODUCT_CATEGORY_ROSTER.find(({ id }) => id === categoryId);
  return leaf?.parent ?? categoryId;
}

/**
 * The products of PRODUCT_ROSTER with the details a catalog page shows (cost,
 * stock, image, warranty…). Every value is fixed per product so the catalog
 * never changes between two fresh databases. Throws when a roster product has
 * no entry in `DETAILS`.
 */
export function buildProducts(): ProductSeed[] {
  return PRODUCT_ROSTER.map((product, index) => {
    const detail = DETAILS.get(product.id);
    if (!detail) throw new Error(`No catalog detail for ${product.id}`);
    const [stock, stockMin] = detail.stock ?? [];
    const seed: ProductSeed = {
      _id: product.id,
      sku: product.sku,
      name: product.name,
      description: detail.description,
      category: product.category,
      price: product.price,
      cost: Math.round(product.price * detail.costRatio * 100) / 100,
      power: product.power > 0 ? product.power : undefined,
      unit: product.unit,
      image: productVisualUrl(familyOf(product.category), product.sku),
      tags: detail.tags,
      isActive: detail.isActive ?? true,
      displayOrder: (index + 1) * 10,
      warrantyYears: detail.warrantyYears,
    };
    if (stock !== undefined) {
      seed.stock = stock;
      seed.stockMin = stockMin;
    }
    return seed;
  });
}
