import path from "node:path";
import { type DocSpec, renderDocument } from "./pdf-layout";

/** `content/helio` at the project root, from src/ or dist/ alike. */
export const CONTENT_DIR = path.join(__dirname, "../../../../content/helio");

export interface BrandFile {
  slug: string;
  name: string;
  mimetype: string;
  alt?: string;
  source: { filePath: string } | { bytes: Uint8Array };
}

/** A logo file shipped in the content folder: tsc copies no asset, so the hand-written SVGs live outside src and are read from disk. */
const brandFile = (fileName: string) => ({
  filePath: path.join(CONTENT_DIR, "brand", fileName),
});

/**
 * The banner of the autumn battery campaign the website runs; its landing
 * page and UTM campaign in the marketing content carry the same name.
 */
const AUTUMN_BANNER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628" width="1200" height="628">
<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C2D12"/><stop offset="1" stop-color="#EA580C"/></linearGradient></defs>
<rect width="1200" height="628" fill="url(#sky)"/>
<circle cx="1010" cy="140" r="260" fill="#FDBA74" opacity=".18"/>
<rect x="820" y="210" width="230" height="330" rx="28" fill="#FFF7ED"/>
<rect x="850" y="250" width="170" height="80" rx="10" fill="#FED7AA"/><rect x="850" y="350" width="170" height="80" rx="10" fill="#FDBA74"/><rect x="850" y="450" width="170" height="60" rx="10" fill="#FB923C"/>
<text x="80" y="170" fill="#FED7AA" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="3">OFFRE D'AUTOMNE</text>
<text x="80" y="270" fill="#FFFFFF" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="78" font-weight="800">Votre soleil d'été,</text>
<text x="80" y="360" fill="#FFFFFF" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="78" font-weight="800">consommé le soir.</text>
<text x="80" y="440" fill="#FFEDD5" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="34">-15 % sur la batterie domestique jusqu'au 30 novembre</text>
<rect x="80" y="486" width="330" height="70" rx="35" fill="#FFFFFF"/>
<text x="245" y="532" fill="#C2410C" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">Simuler mes économies</text>
</svg>`;

const BRAND_GUIDE: DocSpec = {
  label: "Charte graphique",
  title: "Charte graphique Helio",
  subtitle:
    "Logo, couleurs et ton : les règles communes au site, aux devis, aux véhicules et aux réseaux sociaux.",
  reference: "Version 2.1 · 2026",
  blocks: [
    { kind: "heading", text: "Logo" },
    {
      kind: "paragraph",
      text: "Le symbole associe un soleil et un module photovoltaïque. Il s'utilise seul pour les icônes et avatars, et accompagné du nom « helio » en minuscules partout ailleurs.",
    },
    {
      kind: "bullets",
      items: [
        "Zone de protection autour du logo : la hauteur du soleil, sur tous les côtés.",
        "Taille minimale : 24 px de haut à l'écran, 12 mm à l'impression.",
        "Version négative sur fond sombre ; jamais de logo sur une photo chargée.",
      ],
    },
    { kind: "heading", text: "Couleurs" },
    {
      kind: "specs",
      rows: [
        ["Orange Helio", "#EA580C · couleur principale, boutons et en-têtes"],
        ["Ambre", "#F59E0B · mises en avant et graphiques"],
        ["Ardoise", "#1F2937 · textes et fonds sombres"],
        ["Sable", "#FFF7ED · fonds clairs et encadrés"],
      ],
    },
    { kind: "heading", text: "Ton" },
    {
      kind: "paragraph",
      text: "Helio parle comme un voisin compétent : phrases courtes, chiffres concrets, pas de jargon. On vouvoie le client et on donne toujours un ordre de grandeur en euros plutôt qu'en kilowattheures.",
    },
  ],
};

/**
 * Every file of the "Brand & marketing" folder: the logo files, then the
 * campaign banner and the brand guide, which are generated here.
 */
export function brandFiles(): BrandFile[] {
  return [
    {
      slug: "logo",
      name: "Logo Helio.svg",
      mimetype: "image/svg+xml",
      alt: "Logo Helio en couleur",
      source: brandFile("helio-logo.svg"),
    },
    {
      slug: "logo-negative",
      name: "Logo Helio - version négative.svg",
      mimetype: "image/svg+xml",
      alt: "Logo Helio blanc sur fond ardoise",
      source: brandFile("helio-logo-negative.svg"),
    },
    {
      slug: "icon",
      name: "Symbole Helio.svg",
      mimetype: "image/svg+xml",
      alt: "Symbole Helio : un soleil au-dessus d'un panneau",
      source: brandFile("helio-icon.svg"),
    },
    {
      slug: "autumn-banner",
      name: "Bannière offre d'automne batterie.svg",
      mimetype: "image/svg+xml",
      alt: "Bannière de la campagne d'automne : -15 % sur la batterie domestique",
      source: { bytes: Buffer.from(AUTUMN_BANNER, "utf8") },
    },
    {
      slug: "brand-guide",
      name: "Charte graphique Helio.pdf",
      mimetype: "application/pdf",
      source: { bytes: renderDocument(BRAND_GUIDE) },
    },
  ];
}
