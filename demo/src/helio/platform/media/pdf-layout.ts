import {
  fitText,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PdfDocument,
  type PdfPage,
  type Rgb,
  textWidth,
} from "../../sales/pdf";

/** The structured content of one document, written top to bottom. */
export type DocBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "specs"; rows: ReadonlyArray<readonly [string, string]> }
  | { kind: "bullets"; items: readonly string[]; checkbox?: boolean }
  | { kind: "note"; text: string }
  | { kind: "signatures"; parties: readonly string[] };

export interface DocSpec {
  /** Small caps label of the header band: "Fiche technique", "Procédure"… */
  label: string;
  title: string;
  subtitle?: string;
  /** Reference printed under the label, such as a SKU or a version. */
  reference: string;
  blocks: readonly DocBlock[];
}

const ORANGE: Rgb = [0.918, 0.345, 0.047];
const INK: Rgb = [0.12, 0.14, 0.17];
const MUTED: Rgb = [0.42, 0.45, 0.5];
const RULE: Rgb = [0.86, 0.87, 0.89];
const SHADE: Rgb = [0.97, 0.96, 0.94];
const WHITE: Rgb = [1, 1, 1];

const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const LINE_HEIGHT = 14;
const BOTTOM_LIMIT = PAGE_HEIGHT - 70;
const HEADER_HEIGHT = 92;
const SPEC_LABEL_WIDTH = 190;
const SUN_SEGMENTS = 24;

/** Helio's details as the company settings hold them (fictional company). */
export const HELIO_IDENTITY = {
  name: "Helio SRL",
  address: "Rue de l'Énergie 12, 4040 Herstal",
  vat: "TVA BE0742.318.065",
  contact: "+32 4 220 50 50 · contact@helio.example · helio.example",
};

function num(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** A filled polygon, in the page's top-left coordinates. */
function fillPath(
  page: PdfPage,
  points: ReadonlyArray<readonly [number, number]>,
  color: Rgb,
) {
  const [first, ...rest] = points;
  if (!first) return;
  const path = [
    `${num(first[0])} ${num(PAGE_HEIGHT - first[1])} m`,
    ...rest.map(([x, y]) => `${num(x)} ${num(PAGE_HEIGHT - y)} l`),
  ];
  page.ops.push(`${color.map(num).join(" ")} rg ${path.join(" ")} h f`);
}

const RAY_COUNT = 8;

/** Helio's mark: a radiant sun over a solar module, drawn in vectors. */
function drawMark(
  page: PdfPage,
  [x, y]: readonly [number, number],
  size: number,
  color: Rgb,
  background: Rgb,
) {
  const r = size * 0.15;
  const cx = x + size * 0.5;
  const cy = y + size * 0.3;
  const circle = (radius: number, count: number) =>
    Array.from({ length: count }, (_, i): [number, number] => {
      const a = (i / count) * Math.PI * 2;
      return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
    });
  fillPath(page, circle(r, SUN_SEGMENTS), color);
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = (i / RAY_COUNT) * Math.PI * 2;
    const w = 0.12;
    fillPath(
      page,
      [
        [cx + Math.cos(a - w) * r * 1.35, cy + Math.sin(a - w) * r * 1.35],
        [cx + Math.cos(a) * r * 1.95, cy + Math.sin(a) * r * 1.95],
        [cx + Math.cos(a + w) * r * 1.35, cy + Math.sin(a + w) * r * 1.35],
      ],
      color,
    );
  }
  const module: Array<[number, number]> = [
    [x + size * 0.1, y + size * 0.98],
    [x + size * 0.24, y + size * 0.66],
    [x + size * 0.76, y + size * 0.66],
    [x + size * 0.9, y + size * 0.98],
  ];
  fillPath(page, module, color);
  for (const t of [0.36, 0.64]) {
    const top = x + size * (0.24 + 0.52 * t);
    const bottom = x + size * (0.1 + 0.8 * t);
    fillPath(
      page,
      [
        [top - 0.6, y + size * 0.66],
        [top + 0.6, y + size * 0.66],
        [bottom + 0.6, y + size * 0.98],
        [bottom - 0.6, y + size * 0.98],
      ],
      background,
    );
  }
  fillPath(
    page,
    [
      [x + size * 0.17, y + size * 0.81],
      [x + size * 0.83, y + size * 0.81],
      [x + size * 0.84, y + size * 0.83],
      [x + size * 0.16, y + size * 0.83],
    ],
    background,
  );
}

/** Splits a text into lines no wider than `width`. */
export function wrap(text: string, width: number, size = BODY_SIZE): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, "regular") > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

class DocWriter {
  readonly doc: PdfDocument;
  private page: PdfPage;
  private y = 0;

  constructor(private readonly spec: DocSpec) {
    this.doc = new PdfDocument(spec.title);
    this.page = this.doc.addPage();
    this.firstHeader();
  }

  write(block: DocBlock): void {
    if (block.kind === "heading") this.heading(block.text);
    else if (block.kind === "paragraph") this.paragraph(block.text);
    else if (block.kind === "specs") this.specs(block.rows);
    else if (block.kind === "bullets")
      this.bullets(block.items, block.checkbox ?? false);
    else if (block.kind === "note") this.note(block.text);
    else this.signatures(block.parties);
  }

  finish(): string {
    const count = this.doc.pages.length;
    this.doc.pages.forEach((page, index) => {
      page.line(MARGIN, PAGE_HEIGHT - 48, PAGE_WIDTH - MARGIN, RULE);
      page.text(
        MARGIN,
        PAGE_HEIGHT - 34,
        `${HELIO_IDENTITY.name} · ${HELIO_IDENTITY.address} · ${HELIO_IDENTITY.vat}`,
        { size: 7.5, color: MUTED },
      );
      page.text(
        PAGE_WIDTH - MARGIN,
        PAGE_HEIGHT - 34,
        `${index + 1} / ${count}`,
        { size: 7.5, color: MUTED, align: "right" },
      );
    });
    return this.doc.toString();
  }

  private firstHeader(): void {
    const { page, spec } = this;
    page.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, ORANGE);
    drawMark(page, [MARGIN, 24], 40, WHITE, ORANGE);
    page.text(MARGIN + 50, 52, "Helio", {
      size: 22,
      font: "bold",
      color: WHITE,
    });
    page.text(MARGIN + 50, 68, "Solaire · Batteries · Bornes de recharge", {
      size: 8,
      color: WHITE,
    });
    page.text(PAGE_WIDTH - MARGIN, 44, spec.label.toUpperCase(), {
      size: 9,
      font: "bold",
      color: WHITE,
      align: "right",
    });
    page.text(PAGE_WIDTH - MARGIN, 60, spec.reference, {
      size: 9,
      color: WHITE,
      align: "right",
    });
    page.text(MARGIN, 132, fitText(spec.title, CONTENT_WIDTH, 20, "bold"), {
      size: 20,
      font: "bold",
      color: INK,
    });
    this.y = 132;
    if (spec.subtitle) {
      for (const line of wrap(spec.subtitle, CONTENT_WIDTH, 11)) {
        this.y += 17;
        page.text(MARGIN, this.y, line, { size: 11, color: MUTED });
      }
    }
    this.y += 26;
  }

  private ensureRoom(height: number): void {
    if (this.y + height <= BOTTOM_LIMIT) return;
    this.page = this.doc.addPage();
    this.page.rect(0, 0, PAGE_WIDTH, 6, ORANGE);
    this.page.text(
      MARGIN,
      34,
      fitText(this.spec.title, CONTENT_WIDTH, 9, "regular"),
      { size: 9, color: MUTED },
    );
    this.y = 62;
  }

  private heading(text: string): void {
    this.ensureRoom(44);
    this.y += 12;
    this.page.text(MARGIN, this.y, text, {
      size: 12.5,
      font: "bold",
      color: ORANGE,
    });
    this.y += 8;
    this.page.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, RULE);
    this.y += 16;
  }

  private paragraph(text: string): void {
    for (const line of wrap(text, CONTENT_WIDTH)) {
      this.ensureRoom(LINE_HEIGHT);
      this.page.text(MARGIN, this.y, line, { size: BODY_SIZE, color: INK });
      this.y += LINE_HEIGHT;
    }
    this.y += 6;
  }

  private specs(rows: ReadonlyArray<readonly [string, string]>): void {
    rows.forEach(([label, value], index) => {
      const lines = wrap(value, CONTENT_WIDTH - SPEC_LABEL_WIDTH - 16);
      const height = Math.max(lines.length, 1) * LINE_HEIGHT + 8;
      this.ensureRoom(height);
      if (index % 2 === 0)
        this.page.rect(MARGIN, this.y - 11, CONTENT_WIDTH, height, SHADE);
      this.page.text(MARGIN + 8, this.y, label, {
        size: 9.5,
        font: "bold",
        color: INK,
      });
      lines.forEach((line, i) => {
        this.page.text(
          MARGIN + SPEC_LABEL_WIDTH,
          this.y + i * LINE_HEIGHT,
          line,
          { size: 9.5, color: INK },
        );
      });
      this.y += height;
    });
    this.y += 8;
  }

  private bullets(items: readonly string[], checkbox: boolean): void {
    for (const item of items) {
      const lines = wrap(item, CONTENT_WIDTH - 22);
      this.ensureRoom(lines.length * LINE_HEIGHT + 4);
      if (checkbox) {
        this.page.rect(MARGIN + 2, this.y - 8, 9, 9, MUTED);
        this.page.rect(MARGIN + 3, this.y - 7, 7, 7, WHITE);
      } else this.page.rect(MARGIN + 4, this.y - 5, 4, 4, ORANGE);
      lines.forEach((line, i) => {
        this.page.text(MARGIN + 22, this.y + i * LINE_HEIGHT, line, {
          size: BODY_SIZE,
          color: INK,
        });
      });
      this.y += lines.length * LINE_HEIGHT + 4;
    }
    this.y += 6;
  }

  private note(text: string): void {
    const lines = wrap(text, CONTENT_WIDTH - 28);
    const height = lines.length * LINE_HEIGHT + 16;
    this.ensureRoom(height);
    this.page.rect(MARGIN, this.y - 12, CONTENT_WIDTH, height, [1, 0.95, 0.9]);
    this.page.rect(MARGIN, this.y - 12, 4, height, ORANGE);
    lines.forEach((line, i) => {
      this.page.text(MARGIN + 16, this.y + 2 + i * LINE_HEIGHT, line, {
        size: BODY_SIZE,
        color: INK,
      });
    });
    this.y += height + 8;
  }

  private signatures(parties: readonly string[]): void {
    this.ensureRoom(90);
    this.y += 10;
    const width = CONTENT_WIDTH / parties.length;
    parties.forEach((party, i) => {
      const x = MARGIN + i * width;
      this.page.text(x, this.y, party, { size: 9.5, font: "bold", color: INK });
      this.page.text(x, this.y + 14, "Date, nom et signature", {
        size: 8.5,
        color: MUTED,
      });
      this.page.line(x, this.y + 62, x + width - 24, MUTED);
    });
    this.y += 80;
  }
}

/**
 * The document as PDF bytes. It lays out the library's business documents
 * (datasheets, contracts, procedures) on the quotes' dependency-free PDF
 * writer: a branded header, headings, wrapped paragraphs, two-column spec
 * tables, bullet and check lists, and a footer numbering the pages.
 */
export function renderDocument(spec: DocSpec): Buffer {
  const writer = new DocWriter(spec);
  for (const block of spec.blocks) writer.write(block);
  return Buffer.from(writer.finish(), "latin1");
}
