import { GetModel } from "@antelopejs/interface-database-decorators";
import type { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { type CustomerKind, CustomerModel } from "../crm/database";
import { ProjectModel } from "../projects/database";
import { QuoteModel } from "../sales/database";
import type { Invoice, InvoiceStatus } from "./database";
import { type CompanyIdentity, companyIdentity } from "../settings/company";
import { currentSettings } from "../settings/current";
import { DEFAULT_BRAND_COLOR } from "../settings/defaults";
import type { InvoicingSettings } from "../settings/types";
import { type DocumentTexts, documentTexts } from "./document-texts";

interface DocumentParty {
  name: string;
  /** A business is charged the late-payment terms, a household is not. */
  kind?: CustomerKind;
  contactName?: string;
  vatNumber?: string | null;
  address?: DefaultDataTypes.Address;
  email?: string;
}

interface DocumentData {
  invoice: Invoice;
  /** The issuer, as saved on the Settings page. */
  company: CompanyIdentity;
  /** The footer and late-payment terms of the Settings page. */
  terms: Pick<
    InvoicingSettings,
    "invoiceFooter" | "lateInterestRate" | "recoveryFee"
  >;
  customer: DocumentParty;
  projectCode?: string;
  quoteNumber?: string;
}

const HTML_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);

const escapeHtml = (value: string | number | undefined): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => HTML_ESCAPES.get(char) ?? char,
  );

const fill = (template: string, values: ReadonlyMap<string, string>): string =>
  template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => values.get(key) ?? match,
  );

/**
 * The Belgian structured reference (+++123/4567/89012+++) of an invoice
 * number: ten digits from the number, then their remainder modulo 97.
 */
export function structuredReference(number: string): string {
  const digits = number.replace(/\D/g, "").padEnd(10, "0").slice(0, 10);
  const check = Number(BigInt(digits) % 97n) || 97;
  const all = `${digits}${String(check).padStart(2, "0")}`;
  return `+++${all.slice(0, 3)}/${all.slice(3, 7)}/${all.slice(7)}+++`;
}

/** Reads what the document names besides the invoice: customer, project, quote. */
export async function loadDocumentData(
  invoice: Invoice,
): Promise<DocumentData> {
  const [settings, customer, project, quote] = await Promise.all([
    currentSettings(),
    GetModel(CustomerModel).get(invoice.customer),
    invoice.project ? GetModel(ProjectModel).get(invoice.project) : undefined,
    invoice.quote ? GetModel(QuoteModel).get(invoice.quote) : undefined,
  ]);
  return {
    invoice,
    company: companyIdentity(settings),
    terms: {
      invoiceFooter: settings.invoiceFooter,
      lateInterestRate: settings.lateInterestRate,
      recoveryFee: settings.recoveryFee,
    },
    customer: customer ?? { name: invoice.customer },
    projectCode: project?.code,
    quoteNumber: quote?.number,
  };
}

function addressLines(address: DefaultDataTypes.Address | undefined): string[] {
  if (!address) return [];
  const street = [address.streetName, address.houseNumber, address.boxNumber]
    .filter(Boolean)
    .join(" ");
  return [street, `${address.postalCode} ${address.city}`].filter(
    (line) => line.trim().length > 0,
  );
}

function formatters(texts: DocumentTexts) {
  const currency = new Intl.NumberFormat(texts.locale, {
    style: "currency",
    currency: "EUR",
  });
  const date = new Intl.DateTimeFormat(texts.locale, { dateStyle: "long" });
  return {
    money: (amount: number) => currency.format(amount),
    date: (value: Date | undefined) => (value ? date.format(value) : "—"),
  };
}

function stamp(invoice: Invoice, texts: DocumentTexts): string {
  const labels: Partial<Record<InvoiceStatus, string>> = {
    paid: texts.paidStamp,
    cancelled: texts.cancelledStamp,
    draft: texts.draftStamp,
  };
  const label = labels[invoice.status];
  return label
    ? `<div class="stamp ${invoice.status}">${escapeHtml(label)}</div>`
    : "";
}

function partiesBlock(data: DocumentData, texts: DocumentTexts): string {
  const { customer, company: issuer } = data;
  const customerLines = [
    customer.name,
    customer.contactName === customer.name ? undefined : customer.contactName,
    ...addressLines(customer.address),
    customer.vatNumber ? `${texts.vatNumber} ${customer.vatNumber}` : undefined,
  ].filter((line): line is string => !!line);
  return `<section class="parties">
  <div><h2>${escapeHtml(issuer.name)}</h2>
    <p>${[issuer.street, issuer.city, issuer.country, `${texts.vatNumber} ${issuer.vatNumber}`, issuer.email, issuer.phone].map(escapeHtml).join("<br>")}</p></div>
  <div class="billed"><h3>${escapeHtml(texts.billedTo)}</h3>
    <p>${customerLines.map(escapeHtml).join("<br>")}</p></div>
</section>`;
}

function metaBlock(data: DocumentData, texts: DocumentTexts): string {
  const { invoice } = data;
  const format = formatters(texts);
  const rows: Array<[string, string | undefined]> = [
    [texts.number, invoice.number],
    [texts.issuedAt, format.date(invoice.issuedAt)],
    [texts.dueAt, format.date(invoice.dueAt)],
    [texts.project, data.projectCode],
    [texts.quote, data.quoteNumber],
  ];
  return `<dl class="meta">${rows
    .filter(([, value]) => !!value)
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function linesBlock(data: DocumentData, texts: DocumentTexts): string {
  const { invoice } = data;
  const format = formatters(texts);
  const label = data.projectCode
    ? fill(texts.projectLine, new Map([["code", data.projectCode]]))
    : texts.serviceLine;
  const vatLabel = `${texts.vat} ${Math.round(invoice.vatRate * 100)} %`;
  const paid =
    invoice.status === "paid"
      ? invoice.total
      : invoice.total - invoice.amountDue;
  const totals: Array<[string, number, string?]> = [
    [texts.amountExcl, invoice.amountExcl],
    [vatLabel, invoice.vatAmount],
    [texts.total, invoice.total, "strong"],
  ];
  if (paid > 0) totals.push([texts.paid, -paid]);
  totals.push([texts.amountDue, invoice.amountDue, "due"]);
  return `<table class="lines"><thead><tr><th>${escapeHtml(texts.description)}</th><th class="num">${escapeHtml(texts.amountExcl)}</th></tr></thead>
<tbody><tr><td>${escapeHtml(label)}</td><td class="num">${escapeHtml(format.money(invoice.amountExcl))}</td></tr></tbody></table>
<table class="totals">${totals
    .map(
      ([name, amount, kind]) =>
        `<tr class="${kind ?? ""}"><th>${escapeHtml(name)}</th><td class="num">${escapeHtml(format.money(amount))}</td></tr>`,
    )
    .join("")}</table>`;
}

function paymentBlock(data: DocumentData, texts: DocumentTexts): string {
  const { invoice } = data;
  const format = formatters(texts);
  if (invoice.status === "paid") {
    const method =
      texts.methods[invoice.paymentMethod] ?? invoice.paymentMethod;
    return `<section class="payment"><h3>${escapeHtml(texts.paymentTitle)}</h3><p>${escapeHtml(
      fill(
        texts.paidOn,
        new Map([
          ["date", format.date(invoice.paidAt)],
          ["method", method],
        ]),
      ),
    )}</p></section>`;
  }
  if (invoice.status === "cancelled") return "";
  const line = fill(
    texts.paymentLine,
    new Map([
      ["date", format.date(invoice.dueAt)],
      ["iban", data.company.iban],
      ["bic", data.company.bic],
    ]),
  );
  return `<section class="payment"><h3>${escapeHtml(texts.paymentTitle)}</h3><p>${escapeHtml(line)}</p>
<p>${escapeHtml(texts.communication)} <strong class="mono">${escapeHtml(structuredReference(invoice.number))}</strong></p></section>`;
}

const BRAND_COLOR = /^#[0-9a-f]{6}$/i;

/** The brand colour of the Settings page draws the header rule and the dot. */
const styles = (brand: string) => `
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; }
body { font: 13px/1.5 "Helvetica Neue", Arial, sans-serif; color: #1c2430; margin: 0; background: #eef1f5; }
.sheet { position: relative; max-width: 210mm; min-height: 297mm; margin: 24px auto; padding: 18mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${brand}; padding-bottom: 14px; }
.brand { font-size: 26px; font-weight: 700; letter-spacing: -.5px; } .brand span { color: ${brand}; }
h1 { font-size: 30px; margin: 0; font-weight: 300; text-transform: uppercase; letter-spacing: 3px; }
h2 { font-size: 15px; margin: 0 0 4px; } h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7685; margin: 0 0 6px; }
.parties { display: flex; justify-content: space-between; gap: 24px; margin: 22px 0; } .parties p { margin: 0; }
.billed { min-width: 45%; padding: 12px 14px; background: #f7f8fa; border-radius: 6px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 28px; margin: 0 0 22px; } .meta dt { font-size: 11px; color: #6b7685; text-transform: uppercase; letter-spacing: .8px; } .meta dd { margin: 0; font-weight: 600; }
table { width: 100%; border-collapse: collapse; } .num { text-align: right; white-space: nowrap; }
.lines th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #6b7685; border-bottom: 1px solid #d5dae1; padding: 8px 0; }
.lines td { padding: 12px 0; border-bottom: 1px solid #eceff3; }
.totals { width: 55%; margin: 16px 0 0 auto; } .totals th { text-align: left; font-weight: 400; padding: 5px 0; } .totals td { padding: 5px 0; }
.totals .strong th, .totals .strong td { font-weight: 700; border-top: 1px solid #d5dae1; }
.totals .due th, .totals .due td { font-weight: 700; font-size: 16px; color: #b45309; border-top: 2px solid #1c2430; padding-top: 8px; }
.payment { margin-top: 28px; padding: 12px 14px; border: 1px solid #d5dae1; border-radius: 6px; } .payment p { margin: 4px 0; }
.mono { font-family: "SFMono-Regular", Consolas, monospace; letter-spacing: .5px; }
footer { margin-top: 36px; font-size: 11px; color: #6b7685; border-top: 1px solid #eceff3; padding-top: 10px; } footer .custom { color: #1c2430; } footer .custom p { margin: 0 0 4px; }
.stamp { position: absolute; top: 60mm; right: 22mm; transform: rotate(-14deg); border: 3px solid; border-radius: 6px; padding: 4px 14px; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; opacity: .8; }
.stamp.paid { color: #15803d; } .stamp.cancelled { color: #6b7685; } .stamp.draft { color: #b45309; }
@media print { body { background: #fff; } .sheet { margin: 0; padding: 0; box-shadow: none; min-height: auto; } }
`;

/**
 * The footer is the rich text of the Settings page: only these formatting
 * tags are kept, without attributes, so the document never runs a script.
 */
const FOOTER_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s"]);

function footerHtml(html: string | undefined): string {
  return (html ?? "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
      const lower = name.toLowerCase();
      if (!FOOTER_TAGS.has(lower)) return "";
      return tag.startsWith("</") ? `</${lower}>` : `<${lower}>`;
    })
    .trim();
}

function legalLine(data: DocumentData, texts: DocumentTexts): string {
  const { lateInterestRate, recoveryFee } = data.terms;
  const percent = new Intl.NumberFormat(texts.locale, {
    style: "percent",
    maximumFractionDigits: 2,
  });
  const interest = lateInterestRate ? percent.format(lateInterestRate) : "";
  const fee = recoveryFee ? formatters(texts).money(recoveryFee) : "";
  return texts.legal(interest || undefined, fee || undefined);
}

/**
 * The late-payment terms apply to overdue business invoices only (law of
 * 2 August 2002), as the Settings page says: a household's invoice leaves
 * them out.
 */
function footerBlock(data: DocumentData, texts: DocumentTexts): string {
  const footer = footerHtml(data.terms.invoiceFooter);
  const legal =
    data.customer.kind === "business"
      ? `<p>${escapeHtml(legalLine(data, texts))}</p>`
      : "";
  return `<footer>${footer ? `<div class="custom">${footer}</div>` : ""}
${legal}<p>${escapeHtml(texts.demo)}</p></footer>`;
}

/**
 * The invoice as a complete HTML document, in the reader's language: a
 * self-contained, printable page (A4, its own styles, no script). The
 * browser's "Print -> Save as PDF" turns it into a PDF, since producing the
 * PDF on the server would need a rendering dependency.
 */
export function renderInvoiceDocument(
  data: DocumentData,
  language: string | undefined,
): string {
  const texts = documentTexts(language);
  const { invoice } = data;
  const brand = BRAND_COLOR.test(data.company.brandColor)
    ? data.company.brandColor
    : DEFAULT_BRAND_COLOR;
  return `<!doctype html>
<html lang="${escapeHtml(texts.locale)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${texts.title} ${invoice.number}`)}</title><style>${styles(brand)}</style></head>
<body><main class="sheet">${stamp(invoice, texts)}
<header><div class="brand">Helio<span>.</span></div><h1>${escapeHtml(texts.title)}</h1></header>
${partiesBlock(data, texts)}
${metaBlock(data, texts)}
${linesBlock(data, texts)}
${paymentBlock(data, texts)}
${footerBlock(data, texts)}
</main></body></html>`;
}
