import {
  Controller,
  Get,
  HTTPResult,
  Parameter,
} from "@antelopejs/interface-api";
import {
  PRODUCT_FAMILIES,
  SERVICES_FAMILY,
  type ProductFamily,
} from "./options";

/** Where the backend serves the product visuals from. */
export const VISUALS_PATH = "/api/helio/catalog-visuals";

const SIZE = 256;
const MAX_LABEL_LENGTH = 16;
/** A day: the drawing only depends on the URL. */
const CACHE_CONTROL = "public, max-age=86400";

interface FamilyArt {
  color: string;
  /** The family's pictogram, drawn white on the family colour; `{bg}` stands for that colour. */
  pictogram: string;
}

const PANEL_GRID = [1 / 3, 2 / 3]
  .map((t) => {
    const bottom = 64 + 88 * t;
    const top = 108 + 88 * t;
    return `<line x1="${bottom}" y1="150" x2="${top}" y2="70"/>`;
  })
  .join("");

const ART: Record<ProductFamily, FamilyArt> = {
  "cat-panels": {
    color: "#1e3a8a",
    pictogram: `<polygon points="64,150 108,70 196,70 152,150" fill="#fff"/>
<g stroke="{bg}" stroke-width="5">${PANEL_GRID}<line x1="86" y1="110" x2="174" y2="110"/></g>
<rect x="104" y="150" width="8" height="26" fill="#fff"/><rect x="146" y="150" width="8" height="26" fill="#fff"/>`,
  },
  "cat-inverters": {
    color: "#065f46",
    pictogram: `<rect x="84" y="56" width="88" height="116" rx="12" fill="#fff"/>
<rect x="102" y="72" width="52" height="16" rx="3" fill="{bg}"/>
<path d="M98 128 q15 -26 30 0 t30 0" fill="none" stroke="{bg}" stroke-width="7" stroke-linecap="round"/>`,
  },
  "cat-storage": {
    color: "#9a3412",
    pictogram: `<rect x="114" y="50" width="28" height="12" rx="3" fill="#fff"/>
<rect x="92" y="62" width="72" height="114" rx="10" fill="#fff"/>
<g fill="{bg}"><rect x="104" y="144" width="48" height="18" rx="3"/><rect x="104" y="120" width="48" height="18" rx="3"/><rect x="104" y="96" width="48" height="18" rx="3" opacity=".35"/></g>`,
  },
  "cat-ev": {
    color: "#4c1d95",
    pictogram: `<rect x="80" y="54" width="68" height="100" rx="12" fill="#fff"/>
<circle cx="114" cy="92" r="16" fill="{bg}"/><path d="M116 80 l-8 14 h10 l-6 12" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
<path d="M114 154 C114 192 176 192 176 160" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
<rect x="164" y="136" width="24" height="26" rx="5" fill="#fff"/>`,
  },
  "cat-services": {
    color: "#334155",
    pictogram: `<g transform="rotate(-45 128 112)" fill="#fff"><rect x="117" y="104" width="22" height="86" rx="11"/>
<circle cx="128" cy="82" r="34"/><rect x="118" y="40" width="20" height="40" fill="{bg}"/></g>`,
  },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function familyOf(name: string): ProductFamily {
  return (
    PRODUCT_FAMILIES.find((family) => family.value === name)?.value ??
    SERVICES_FAMILY
  );
}

/** The visual of a product of `family`, captioned with `label` (its SKU). */
export function renderProductVisual(family: string, label: string): string {
  const art = ART[familyOf(family)];
  const caption = escapeXml(label.slice(0, MAX_LABEL_LENGTH));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="${art.color}"/>
<circle cx="214" cy="40" r="90" fill="#fff" opacity=".07"/>
${art.pictogram.replace(/\{bg\}/g, art.color)}
<text x="128" y="224" fill="#fff" fill-opacity=".85" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="19" font-weight="700" text-anchor="middle">${caption}</text>
</svg>`;
}

/** The URL of a product's visual, as the catalog fixtures store it. */
export function productVisualUrl(family: string, sku: string): string {
  return `${VISUALS_PATH}/${family}/${encodeURIComponent(sku)}`;
}

/**
 * Serves the product visuals, drawn as SVG by the backend itself: a pictogram
 * of the product family on its colour, with the SKU underneath. Nothing is
 * fetched from the network nor stored, so the catalog shows pictures offline
 * and the same ones on every machine. Native `ImageType` values cannot be
 * seeded, so products keep a plain image URL pointing here.
 *
 * Public on purpose, like a product photo on a CDN: an <img> sends no token,
 * and the drawing holds nothing but a family and a SKU.
 */
export class CatalogVisualsApi extends Controller(VISUALS_PATH) {
  @Get(":family/:label")
  getVisual(
    @Parameter("family", "param") family: string,
    @Parameter("label", "param") label: string,
  ): HTTPResult {
    return HTTPResult.withHeaders(
      new HTTPResult(200, renderProductVisual(family, label), "image/svg+xml"),
      { "Cache-Control": CACHE_CONTROL },
    );
  }
}
