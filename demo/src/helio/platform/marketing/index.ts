import { Logging } from "@antelopejs/interface-core/logging";
import {
  EnsureFunnel,
  EnsureWebsite,
  ImportAnalytics,
} from "@antelopejs/interface-dms-marketing";
import { historyImports } from "./history";
import { HELIO_WEBSITE, helioFunnels } from "./site";
import { helioNow } from "../../shared/clock";

/**
 * Ships Helio's public website to the marketing module as code: the site, its
 * funnels (one A/B test running on the simulator, one finished on the contact
 * form) and twelve weeks of imported traffic. Called when the DMS provisions
 * the default tenant; the content is written once, and from then on it belongs
 * to the tenant. The traffic is imported after the funnels, because an
 * exposure only counts once its split left draft. An import that answers
 * `in_progress` or `failed` is not done, so the step fails and runs again later.
 */
export async function provisionHelioMarketing(): Promise<void> {
  const now = helioNow();
  const site = await EnsureWebsite(HELIO_WEBSITE);
  const funnels = [];
  for (const funnel of helioFunnels(now)) {
    funnels.push(await EnsureFunnel(funnel));
  }
  Logging.Info(
    `[helio] marketing declared: website ${site.status}, funnels ${funnels.map((f) => `${f.id} ${f.status}`).join(", ")}`,
  );
  for (const batch of historyImports(now)) {
    const result = await ImportAnalytics(batch);
    Logging.Info(
      `[helio] marketing history ${result.importId}: ${result.status}, ${result.sessions} visits, ${result.events} events, ${result.dropped} dropped`,
    );
    if (result.status === "in_progress" || result.status === "failed") {
      throw new Error(`${result.importId} is not imported: ${result.status}`);
    }
  }
}
