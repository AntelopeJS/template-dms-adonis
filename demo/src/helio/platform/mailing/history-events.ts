import { createHash } from "node:crypto";
import type { ImportedSendEvent } from "@antelopejs/interface-dms-mailing";
import { createRng, type Rng } from "../../shared/seed";
import { helioNow } from "../../shared/clock";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** How a kind of e-mail is read: its open rate, and how often its link is followed. */
export interface Engagement {
  openRate: number;
  clickRate: number;
}

const HARD_BOUNCE_RATE = 0.015;
const SOFT_BOUNCE_RATE = 0.01;
const SPAM_RATE = 0.004;
const SECOND_OPEN_RATE = 0.3;

function seedOf(importId: string): number {
  return createHash("sha256").update(importId).digest().readUInt32BE(0);
}

const after = (at: Date, ms: number) => new Date(at.getTime() + ms);

function bounce(rng: Rng, sentAt: Date, email: string): ImportedSendEvent {
  const hard =
    rng.next() < HARD_BOUNCE_RATE / (HARD_BOUNCE_RATE + SOFT_BOUNCE_RATE);
  return {
    type: "bounced",
    at: after(sentAt, rng.int(5, 90) * SECOND_MS),
    details: hard
      ? {
          bounceType: "hard",
          reason: `550 5.1.1 <${email}>: Recipient address rejected: User unknown`,
        }
      : { bounceType: "soft", reason: "452 4.2.2 Mailbox full" },
  };
}

/**
 * The opens and clicks of a delivered e-mail. Nothing is dated in the future:
 * an e-mail sent an hour ago had little time to be read.
 */
function reading(
  rng: Rng,
  delivered: Date,
  engagement: Engagement,
  now: number,
): ImportedSendEvent[] {
  if (!rng.chance(engagement.openRate)) return [];
  const opened = after(delivered, rng.int(3, 36 * 60) * MINUTE_MS);
  if (opened.getTime() > now) return [];
  const events: ImportedSendEvent[] = [{ type: "opened", at: opened }];
  if (rng.chance(engagement.clickRate)) {
    events.push({
      type: "clicked",
      at: after(opened, rng.int(1, 15) * MINUTE_MS),
      details: { url: "portal" },
    });
  }
  if (rng.chance(SECOND_OPEN_RATE)) {
    const again = after(opened, rng.int(2, 48) * HOUR_MS);
    if (again.getTime() <= now) events.push({ type: "opened", at: again });
  }
  return events;
}

/**
 * The provider events of one imported send, in the order they happened: most
 * e-mails are delivered within the minute, many are opened in the following
 * hours, some links are clicked, and a few addresses bounce. They are drawn
 * from a PRNG seeded by the send's import id, so a re-import tells the same
 * story.
 */
export function historyEvents(
  importId: string,
  email: string,
  sentAt: Date,
  engagement: Engagement,
): ImportedSendEvent[] {
  const rng = createRng(seedOf(importId));
  const now = helioNow();
  const events: ImportedSendEvent[] = [{ type: "sent", at: sentAt }];
  if (rng.chance(HARD_BOUNCE_RATE + SOFT_BOUNCE_RATE)) {
    return [...events, bounce(rng, sentAt, email)];
  }
  const delivered = after(sentAt, rng.int(2, 75) * SECOND_MS);
  events.push({ type: "delivered", at: delivered });
  if (rng.chance(SPAM_RATE)) {
    return [...events, { type: "spam", at: after(delivered, 2 * HOUR_MS) }];
  }
  return [...events, ...reading(rng, delivered, engagement, now)];
}
