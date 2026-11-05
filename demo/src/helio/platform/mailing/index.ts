import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { Logging } from "@antelopejs/interface-core/logging";
import {
  DeclareTemplate,
  DeclareTemplateCategory,
} from "@antelopejs/interface-dms-mailing";
import { HELIO_MAIL_CATEGORY } from "./format";
import { importMailHistory } from "./history";
import { recordNotice } from "./notices";
import { BILLING_TEMPLATES } from "./templates-billing";
import { SALES_TEMPLATES } from "./templates-sales";
import { SERVICE_TEMPLATES } from "./templates-service";

export {
  mailInstallation,
  mailInvoiceReminder,
  mailQuoteAccepted,
  mailQuoteSent,
  mailTicketReceived,
  mailTicketsResolved,
  MAIL_SOURCES,
} from "./send";
export { noticedRecords, recordNotice } from "./notices";

const TEMPLATES = [
  ...SALES_TEMPLATES,
  ...BILLING_TEMPLATES,
  ...SERVICE_TEMPLATES,
];

async function declareTemplates(): Promise<void> {
  await DeclareTemplateCategory({
    tenantId: DEFAULT_TENANT_ID,
    id: HELIO_MAIL_CATEGORY,
    label: { en: "Helio", fr: "Helio" },
    icon: "i-ph-sun",
  });
  const outcomes: string[] = [];
  for (const template of TEMPLATES) {
    const { outcome } = await DeclareTemplate({
      ...template,
      author: "Helio",
    });
    outcomes.push(`${template.slug}=${outcome}`);
  }
  Logging.Info(`[helio] mail templates: ${outcomes.join(", ")}`);
}

/** Imports the send history and notes the installations it confirmed, so the weekly confirmation run does not write again to those customers. */
async function importHistory(): Promise<void> {
  const history = await importMailHistory();
  for (const { projectId, sentAt } of history.confirmedProjects) {
    await recordNotice("installation", projectId, sentAt);
  }
  Logging.Info(
    `[helio] mail history: ${history.imported} imported, ${history.skipped} already there, ${history.reported} bounce/complaint event(s) reported`,
  );
}

/**
 * Ships Helio's transactional e-mails as code to the Mailing module: one
 * "Helio" category, seven templates in French and English, and the history of
 * the last weeks. It declares the templates, then imports the history (which
 * names them). Called when the DMS provisions the default tenant, so the
 * history reads the Helio collections, registered on `DATABASE_INITIALIZED`
 * before it. They are written once: from then on they belong to the tenant.
 */
export async function provisionHelioMailing(): Promise<void> {
  await declareTemplates();
  await importHistory();
}
