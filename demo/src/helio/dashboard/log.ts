import { Logging } from "@antelopejs/interface-core/logging";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import {
  ACTIVITY_TONES,
  type ActivityRecordKind,
  type ActivityType,
  activityLink,
} from "./activity-links";
import { ActivityModel } from "./database";
import { helioNow } from "../shared/clock";

export { ACTIVITY_TONES, activityLink, HELIO_LINKS } from "./activity-links";

/** Published when an entry is logged: the activity feed reads again. */
export const ACTIVITY_TOPIC = "helio:activity";

export interface ActivityEntry {
  type: ActivityType;
  /** `_id` of the team member the event belongs to. */
  actor: string;
  /** What it is about, as written: "Q-2026-0042 · Dupont". */
  subject: string;
  record: { kind: ActivityRecordKind; id: string };
}

let sequence = 0;

/**
 * Writes what users do to helio_activity, so the dashboard's activity feed
 * reflects the business as it moves: a quote sent or accepted, a deal won, a
 * project finished, a ticket resolved, an invoice paid. Every Helio domain
 * logs through here, with the same links and tones as the seeded history.
 * Logs the events now and tells the open dashboards. Never fails the
 * action that logged them: the action is done, a missing feed entry is not
 * worth an error for the user.
 */
export async function logActivity(
  ...entries: readonly ActivityEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const model = GetModel(ActivityModel);
    const at = new Date(helioNow());
    for (const entry of entries) {
      sequence += 1;
      await model.insert({
        _id: `act-${at.getTime().toString(36)}-${sequence}`,
        at,
        actor: entry.actor,
        type: entry.type,
        subject: entry.subject,
        link: activityLink(entry.record.kind, entry.record.id),
        tone: ACTIVITY_TONES[entry.type],
      });
    }
    await PublishMessage(ACTIVITY_TOPIC, "activity.logged", {
      payload: { count: entries.length },
    });
  } catch (error: unknown) {
    Logging.Error(`[helio] activity log: ${String(error)}`);
  }
}
