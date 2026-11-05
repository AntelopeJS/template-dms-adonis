import { GetModel } from "@antelopejs/interface-database-decorators";
import type {
  ActivityFeedItem,
  ActivityFeedResponse,
} from "@antelopejs/interface-dms/base/activity-feed";
import type { BannerContent } from "@antelopejs/interface-dms/base/banner";
import { SiteModel } from "../monitoring/database";
import { TeamMemberModel } from "../team/database";
import { type Activity, ActivityModel } from "./database";
import { HELIO_PAGES } from "./links";
import { ACTIVITY_TYPES } from "./options";
import { type Period, toTime, within } from "./period";

const FEED_LENGTH = 12;

function feedItem(
  event: Activity,
  actorName: string | undefined,
): ActivityFeedItem {
  const type = ACTIVITY_TYPES.find((entry) => entry.value === event.type);
  return {
    id: event._id,
    icon: type?.icon,
    tone: event.tone,
    title: type?.label ?? event.type,
    meta: actorName ? [event.subject, actorName] : [event.subject],
    date: new Date(toTime(event.at)).toISOString(),
    to: event.link,
  };
}

/** The latest business events of helio_activity over the period, newest first. */
export async function activityFeed(
  period: Period,
): Promise<ActivityFeedResponse> {
  const [events, team] = await Promise.all([
    GetModel(ActivityModel).getAll(),
    GetModel(TeamMemberModel).getAll(),
  ]);
  const names = new Map(team.map((member) => [member._id, member.name]));
  const inPeriod = events
    .filter((event) => within(event.at, period.range))
    .sort((a, b) => toTime(b.at) - toTime(a.at));
  return {
    items: inPeriod
      .slice(0, FEED_LENGTH)
      .map((event) => feedItem(event, names.get(event.actor))),
    count: inPeriod.length,
  };
}

/** Cents, as the composed-text money parameter takes them. */
export function minorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * An alert while installed sites have stopped reporting; nothing otherwise.
 * Overdue invoices have their own banner (finance/banner.ts): this one says
 * lost production.
 */
export async function offlineSitesBanner(): Promise<BannerContent | null> {
  const offline = (await GetModel(SiteModel).getAll())
    .filter((site) => site.inverterStatus === "offline")
    .sort((a, b) => toTime(a.lastSeenAt) - toTime(b.lastSeenAt));
  const first = offline[0];
  if (!first) return null;
  return {
    tone: "error",
    icon: "i-ph-plugs",
    title: {
      key: "$helio.dashboard.offline.title",
      params: { count: { type: "count", value: offline.length } },
    },
    description: {
      key: "$helio.dashboard.offline.description",
      params: {
        sites: offline.map((site) => `${site.name} (${site.city})`).join(", "),
        since: {
          type: "datetime",
          value: new Date(toTime(first.lastSeenAt)).toISOString(),
        },
      },
    },
    actions: [
      { label: "$helio.dashboard.offline.service", to: HELIO_PAGES.service },
      {
        label: "$helio.dashboard.offline.action",
        to: HELIO_PAGES.monitoring,
      },
    ],
  };
}
