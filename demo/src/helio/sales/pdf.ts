export type FontStyle = "regular" | "bold";
export type Rgb = readonly [number, number, number];
export type Align = "left" | "right" | "center";

export interface TextStyle {
  size: number;
  font?: FontStyle;
  color?: Rgb;
  align?: Align;
}

/** A4 portrait, in points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

/**
 * Advance widths (1/1000 em) of the printable ASCII characters, 32 to 126, in
 * Helvetica, from the Adobe metrics of the font.
 */
const REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
/** The same widths as `REGULAR_WIDTHS`, in Helvetica-Bold. */
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];
const DEFAULT_WIDTH = 556;

/** WinAnsi codes of the characters it places outside Latin-1. */
const WIN_ANSI_EXTRA: ReadonlyMap<string, number> = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["„", 0x84],
  ["…", 0x85],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["™", 0x99],
  ["œ", 0x9c],
  ["Œ", 0x8c],
]);

/**
 * Thin and narrow spaces (Intl writes "1 234,00 €" with U+202F), which become
 * plain ones, as every reader draws those.
 */
const SPACES = new Set([" ", " "]);

function winAnsiCode(char: string): number | undefined {
  if (SPACES.has(char)) return 32;
  const extra = WIN_ANSI_EXTRA.get(char);
  if (extra !== undefined) return extra;
  const code = char.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 126) return code;
  if (code >= 160 && code <= 255) return code;
  return undefined;
}

/** Width of a character in 1/1000 em. An accented letter is as wide as its base letter, close enough. */
function charWidth(char: string, font: FontStyle): number {
  const table = font === "bold" ? BOLD_WIDTHS : REGULAR_WIDTHS;
  const code = winAnsiCode(char) ?? 63;
  if (code >= 32 && code <= 126) return table[code - 32] ?? DEFAULT_WIDTH;
  if (code === 160) return table[0] ?? DEFAULT_WIDTH;
  const base = char.normalize("NFD").charAt(0);
  const baseCode = base.codePointAt(0) ?? 0;
  return baseCode >= 32 && baseCode <= 126
    ? (table[baseCode - 32] ?? DEFAULT_WIDTH)
    : DEFAULT_WIDTH;
}

/** Width of a text in points. */
export function textWidth(text: string, size: number, font: FontStyle) {
  let width = 0;
  for (const char of text) width += charWidth(char, font);
  return (width * size) / 1000;
}

/** The text, cut with an ellipsis so it fits `maxWidth`. */
export function fitText(
  text: string,
  maxWidth: number,
  size: number,
  font: FontStyle,
): string {
  if (textWidth(text, size, font) <= maxWidth) return text;
  const chars = Array.from(text);
  while (
    chars.length > 0 &&
    textWidth(`${chars.join("")}…`, size, font) > maxWidth
  ) {
    chars.pop();
  }
  return `${chars.join("").trimEnd()}…`;
}

/** The text as a PDF literal string, in WinAnsi. */
function literal(text: string): string {
  let out = "";
  for (const char of text) {
    const code = winAnsiCode(char) ?? 63;
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code >= 32 && code <= 126) out += String.fromCharCode(code);
    else out += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return `(${out})`;
}

const num = (value: number) => Number(value.toFixed(2)).toString();
const rgb = ([r, g, b]: Rgb) => `${num(r)} ${num(g)} ${num(b)}`;

/** One page; coordinates start at its top-left corner, y going down. */
export class PdfPage {
  readonly ops: string[] = [];

  text(x: number, y: number, text: string, style: TextStyle): void {
    const font = style.font ?? "regular";
    const width = textWidth(text, style.size, font);
    const left =
      style.align === "right"
        ? x - width
        : style.align === "center"
          ? x - width / 2
          : x;
    this.ops.push(
      `BT /${font === "bold" ? "F2" : "F1"} ${num(style.size)} Tf ${rgb(style.color ?? [0, 0, 0])} rg ${num(left)} ${num(PAGE_HEIGHT - y)} Td ${literal(text)} Tj ET`,
    );
  }

  rect(x: number, y: number, width: number, height: number, fill: Rgb): void {
    this.ops.push(
      `${rgb(fill)} rg ${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re f`,
    );
  }

  line(x1: number, y: number, x2: number, color: Rgb, width = 0.5): void {
    this.ops.push(
      `${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(PAGE_HEIGHT - y)} m ${num(x2)} ${num(PAGE_HEIGHT - y)} l S`,
    );
  }
}

/**
 * The pages of a document, written out as a PDF file. A minimal writer, enough
 * for a one-or-two-page business document: text in Helvetica and
 * Helvetica-Bold (two of the 14 fonts every PDF reader ships, so nothing is
 * embedded), filled rectangles and lines. The whole file is ASCII (characters
 * outside it are written as octal escapes in the WinAnsi encoding), so it
 * travels as a plain string through the HTTP layer, with no binary body to
 * handle and no dependency to add.
 */
export class PdfDocument {
  readonly pages: PdfPage[] = [];

  constructor(private readonly title: string) {}

  addPage(): PdfPage {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  toString(): string {
    const objects: string[] = [];
    const add = (body: string) => objects.push(body);
    const pageRefs = this.pages.map((_, i) => `${5 + i * 2} 0 R`);
    add("<< /Type /Catalog /Pages 2 0 R >>");
    add(
      `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${this.pages.length} >>`,
    );
    add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );
    this.pages.forEach((page, i) => {
      const content = page.ops.join("\n");
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      );
      add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    add(`<< /Title ${literal(this.title)} /Producer (Helio) >>`);
    return serialize(objects);
  }
}

/**
 * Writes the objects, numbered from 1, then the cross-reference table filled
 * with their byte offsets (the file being ASCII, characters are bytes).
 */
function serialize(objects: string[]): string {
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}
