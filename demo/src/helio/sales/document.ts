import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import type { Customer } from "../crm/database";
import { PRODUCT_ROSTER } from "../shared/roster";
import type { CompanyIdentity } from "../settings/company";
import type { Quote, QuoteLine } from "./database";
import {
  type DocumentTexts,
  documentTexts,
  type DocumentLanguage,
} from "./document-texts";
import { VAT_BUSINESS } from "./lines";
import {
  fitText,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PdfDocument,
  type PdfPage,
  type Rgb,
} from "./pdf";

export interface QuoteDocumentInput {
  quote: Quote;
  customer?: Customer;
  dealTitle?: string;
  language: DocumentLanguage;
  /** The issuer, as saved on the Settings page. */
  company: CompanyIdentity;
}

const LEFT = 48;
const RIGHT = PAGE_WIDTH - 48;
const ROW_HEIGHT = 20;
/**
 * Where a page's rows stop, in points from the top. The totals, terms and
 * signature must fit above it too, else they move to a page of their own.
 */
const ROWS_BOTTOM = 770;

/** The height the totals, terms and signature need below the last row. */
const END_BLOCK = 200;

/** Helio's brand colour, which the one of the Settings page replaces when it is a valid #RRGGBB. */
const ORANGE: Rgb = [0.96, 0.55, 0.11];
const INK: Rgb = [0.11, 0.13, 0.17];
const MUTED: Rgb = [0.42, 0.45, 0.5];
const HAIRLINE: Rgb = [0.86, 0.87, 0.89];
const PANEL: Rgb = [0.965, 0.969, 0.976];
const ZEBRA: Rgb = [0.985, 0.985, 0.99];
const WHITE: Rgb = [1, 1, 1];

/** Columns of the lines table: where each starts (left) or ends (right). */
const COL = {
  ref: LEFT + 8,
  label: 122,
  qty: 372,
  unit: 462,
  total: RIGHT - 8,
};

interface Formatters {
  texts: DocumentTexts;
  /** The brand colour, and the light tint of it behind the total. */
  brand: Rgb;
  tint: Rgb;
  /** The line under the brand: the Settings page's tagline, else ours. */
  tagline: string;
  money: (amount: number) => string;
  qty: (value: number) => string;
  date: (date: Date | undefined) => string;
  percent: (rate: number) => string;
}

function brandRgb(color: string | undefined): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color ?? "");
  if (!match) return ORANGE;
  const [r = 0, g = 0, b = 0] = match
    .slice(1)
    .map((hex) => parseInt(hex, 16) / 255);
  return [r, g, b];
}

/** A tenth of the colour on white. */
const tintOf = (color: Rgb): Rgb => [
  0.9 + color[0] / 10,
  0.9 + color[1] / 10,
  0.9 + color[2] / 10,
];

function taglineIn(
  tagline: Record<string, string> | undefined,
  language: DocumentLanguage,
): string | undefined {
  const entry = Object.entries(tagline ?? {}).find(([locale]) =>
    locale.toLowerCase().startsWith(language),
  );
  return entry?.[1]?.trim() || undefined;
}

function formatters(
  language: DocumentLanguage,
  company: CompanyIdentity,
): Formatters {
  const texts = documentTexts(language);
  const brand = brandRgb(company.brandColor);
  const money = new Intl.NumberFormat(texts.locale, {
    style: "currency",
    currency: "EUR",
  });
  const qty = new Intl.NumberFormat(texts.locale, { maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(texts.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  });
  const percent = new Intl.NumberFormat(texts.locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  return {
    texts,
    brand,
    tint: tintOf(brand),
    tagline: taglineIn(company.tagline, language) ?? texts.tagline,
    money: (amount) => money.format(amount),
    qty: (value) => qty.format(value),
    date: (value) => (value ? date.format(value) : "—"),
    percent: (rate) => percent.format(rate),
  };
}

function addressLines(address: DefaultDataTypes.Address | undefined): string[] {
  if (!address) return [];
  const street = [address.streetName, address.houseNumber]
    .filter(Boolean)
    .join(" ");
  const box = address.boxNumber ? ` bte ${address.boxNumber}` : "";
  return [`${street}${box}`, `${address.postalCode} ${address.city}`];
}

function drawBrand(page: PdfPage, f: Formatters, quote: Quote): void {
  page.rect(0, 0, PAGE_WIDTH, 6, f.brand);
  page.text(LEFT, 62, "HELIO", { size: 26, font: "bold", color: f.brand });
  page.text(LEFT, 78, f.tagline, { size: 8.5, color: MUTED });
  page.text(RIGHT, 56, f.texts.title, {
    size: 20,
    font: "bold",
    color: INK,
    align: "right",
  });
  page.text(RIGHT, 74, quote.number, {
    size: 11,
    font: "bold",
    color: MUTED,
    align: "right",
  });
}

function drawParties(page: PdfPage, f: Formatters, input: QuoteDocumentInput) {
  const issuer = input.company;
  const company = [
    issuer.street,
    issuer.city,
    `${f.texts.vat} ${issuer.vatNumber}`,
    issuer.phone,
    issuer.email,
  ];
  page.text(LEFT, 116, issuer.name, {
    size: 9.5,
    font: "bold",
    color: INK,
  });
  company.forEach((line, i) => {
    page.text(LEFT, 130 + i * 12, line, { size: 8.5, color: MUTED });
  });

  const { customer } = input;
  const boxX = 318;
  const boxWidth = RIGHT - boxX;
  page.rect(boxX, 100, boxWidth, 100, PANEL);
  page.text(boxX + 14, 117, f.texts.customer, {
    size: 7.5,
    font: "bold",
    color: MUTED,
  });
  const name = customer?.name ?? "—";
  page.text(boxX + 14, 134, fitText(name, boxWidth - 28, 11, "bold"), {
    size: 11,
    font: "bold",
    color: INK,
  });
  const details = [
    customer?.kind === "business" ? customer.contactName : undefined,
    ...addressLines(customer?.address),
    customer?.vatNumber ? `${f.texts.vat} ${customer.vatNumber}` : undefined,
    customer?.email,
  ].filter((line): line is string => Boolean(line));
  details.slice(0, 5).forEach((line, i) => {
    page.text(
      boxX + 14,
      149 + i * 11,
      fitText(line, boxWidth - 28, 8.5, "regular"),
      {
        size: 8.5,
        color: MUTED,
      },
    );
  });
}

function drawMeta(page: PdfPage, f: Formatters, input: QuoteDocumentInput) {
  const cells = [
    { x: LEFT, label: f.texts.issuedAt, value: f.date(input.quote.issuedAt) },
    {
      x: 170,
      label: f.texts.validUntil,
      value: f.date(input.quote.validUntil),
    },
    {
      x: 292,
      label: f.texts.subject,
      value: input.dealTitle ?? f.texts.noSubject,
    },
  ];
  page.line(LEFT, 214, RIGHT, HAIRLINE);
  for (const cell of cells) {
    page.text(cell.x, 230, cell.label, { size: 7.5, color: MUTED });
    page.text(cell.x, 244, fitText(cell.value, RIGHT - cell.x, 9.5, "bold"), {
      size: 9.5,
      font: "bold",
      color: INK,
    });
  }
  page.line(LEFT, 256, RIGHT, HAIRLINE);
}

function drawTableHeader(page: PdfPage, f: Formatters, y: number): number {
  page.rect(LEFT, y, RIGHT - LEFT, 22, INK);
  const style = { size: 8, font: "bold", color: WHITE } as const;
  const baseline = y + 14.5;
  page.text(COL.ref, baseline, f.texts.columns.ref, style);
  page.text(COL.label, baseline, f.texts.columns.description, style);
  page.text(COL.qty, baseline, f.texts.columns.qty, {
    ...style,
    align: "right",
  });
  page.text(COL.unit, baseline, f.texts.columns.unitPrice, {
    ...style,
    align: "right",
  });
  page.text(COL.total, baseline, f.texts.columns.total, {
    ...style,
    align: "right",
  });
  return y + 22;
}

function drawRow(
  page: PdfPage,
  f: Formatters,
  line: QuoteLine,
  y: number,
  odd: boolean,
) {
  if (odd) page.rect(LEFT, y, RIGHT - LEFT, ROW_HEIGHT, ZEBRA);
  const baseline = y + 13.5;
  const sku =
    PRODUCT_ROSTER.find((entry) => entry.id === line.product)?.sku ?? "";
  page.text(
    COL.ref,
    baseline,
    fitText(sku, COL.label - COL.ref - 6, 7.5, "regular"),
    {
      size: 7.5,
      color: MUTED,
    },
  );
  page.text(
    COL.label,
    baseline,
    fitText(line.label, COL.qty - COL.label - 40, 9, "regular"),
    {
      size: 9,
      color: INK,
    },
  );
  const right = { size: 9, color: INK, align: "right" } as const;
  page.text(COL.qty, baseline, f.qty(line.qty), right);
  page.text(COL.unit, baseline, f.money(line.unitPrice), right);
  page.text(COL.total, baseline, f.money(line.qty * line.unitPrice), {
    ...right,
    font: "bold",
  });
  page.line(LEFT, y + ROW_HEIGHT, RIGHT, HAIRLINE, 0.4);
}

function drawTotals(page: PdfPage, f: Formatters, quote: Quote, top: number) {
  const labelX = 350;
  const vatAmount = Math.round((quote.total - quote.subtotal) * 100) / 100;
  const rows = [
    [f.texts.subtotal, f.money(quote.subtotal)],
    [f.texts.vatLine(f.percent(quote.vatRate)), f.money(vatAmount)],
  ];
  rows.forEach(([label, value], i) => {
    const y = top + 18 + i * 16;
    page.text(labelX, y, label ?? "", { size: 9, color: MUTED });
    page.text(COL.total, y, value ?? "", {
      size: 9,
      color: INK,
      align: "right",
    });
  });
  const bandY = top + 46;
  page.rect(labelX - 10, bandY, RIGHT - labelX + 10, 26, f.tint);
  page.text(labelX, bandY + 17, f.texts.grandTotal, {
    size: 10.5,
    font: "bold",
    color: INK,
  });
  page.text(COL.total, bandY + 17, f.money(quote.total), {
    size: 12,
    font: "bold",
    color: f.brand,
    align: "right",
  });
}

/** Draws the terms and the signature box. The VAT mention follows the rate the quote applies, not the customer. */
function drawTermsAndSignature(
  page: PdfPage,
  f: Formatters,
  input: QuoteDocumentInput,
  top: number,
) {
  const { quote } = input;
  const y = top + 96;
  page.text(LEFT, y, f.texts.terms, { size: 9, font: "bold", color: INK });
  const reducedVat = quote.vatRate < VAT_BUSINESS;
  f.texts.termLines(f.date(quote.validUntil), reducedVat).forEach((line, i) => {
    page.text(LEFT, y + 15 + i * 11.5, fitText(line, 270, 7.5, "regular"), {
      size: 7.5,
      color: MUTED,
    });
  });
  const boxX = 340;
  page.rect(boxX, y - 12, RIGHT - boxX, 78, PANEL);
  page.text(boxX + 12, y + 3, f.texts.approval, {
    size: 9,
    font: "bold",
    color: INK,
  });
  const signed = quote.status === "accepted" && quote.signedAt;
  page.text(
    boxX + 12,
    y + 18,
    signed ? f.texts.signedOn(f.date(quote.signedAt)) : f.texts.approvalHint,
    {
      size: 8,
      color: signed ? [0.13, 0.55, 0.3] : MUTED,
      font: signed ? "bold" : "regular",
    },
  );
}

function drawFooters(
  doc: PdfDocument,
  f: Formatters,
  company: CompanyIdentity,
): void {
  const line = [
    company.name,
    `${company.street}, ${company.city}`,
    `${f.texts.vat} ${company.vatNumber}`,
    `IBAN ${company.iban}`,
    company.website,
  ].join("  ·  ");
  doc.pages.forEach((page, i) => {
    page.line(LEFT, PAGE_HEIGHT - 44, RIGHT, HAIRLINE);
    page.text(LEFT, PAGE_HEIGHT - 30, line, { size: 7, color: MUTED });
    page.text(RIGHT, PAGE_HEIGHT - 30, f.texts.page(i + 1, doc.pages.length), {
      size: 7,
      color: MUTED,
      align: "right",
    });
  });
}

/** A page after the first: a short header, then the table goes on. */
function continuationPage(
  doc: PdfDocument,
  f: Formatters,
  quote: Quote,
): PdfPage {
  const page = doc.addPage();
  page.rect(0, 0, PAGE_WIDTH, 6, f.brand);
  page.text(LEFT, 44, "HELIO", { size: 14, font: "bold", color: f.brand });
  page.text(RIGHT, 44, `${f.texts.continued} · ${quote.number}`, {
    size: 9,
    color: MUTED,
    align: "right",
  });
  return page;
}

/**
 * The quote as the customer receives it, as a PDF file (an ASCII string): an A4
 * page with Helio's header, the customer, the lines, the totals, the terms and
 * a box for the signature, continued on further pages when the lines need them.
 */
export function renderQuoteDocument(input: QuoteDocumentInput): string {
  const f = formatters(input.language, input.company);
  const { quote } = input;
  const doc = new PdfDocument(`${f.texts.title} ${quote.number}`);
  let page = doc.addPage();
  drawBrand(page, f, quote);
  drawParties(page, f, input);
  drawMeta(page, f, input);
  let y = drawTableHeader(page, f, 272);
  (quote.lines ?? []).forEach((line, i) => {
    if (y + ROW_HEIGHT > ROWS_BOTTOM) {
      page = continuationPage(doc, f, quote);
      y = drawTableHeader(page, f, 64);
    }
    drawRow(page, f, line, y, i % 2 === 1);
    y += ROW_HEIGHT;
  });
  if (y + END_BLOCK > ROWS_BOTTOM) {
    page = continuationPage(doc, f, quote);
    y = 64;
  }
  drawTotals(page, f, quote, y);
  drawTermsAndSignature(page, f, input, y);
  drawFooters(doc, f, input.company);
  return doc.toString();
}
