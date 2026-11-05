import type { MarketingImportEvent } from "@antelopejs/interface-dms-marketing";
import { DAY_MS, type Rng } from "../../shared/seed";
import type { Acquisition, Visitor } from "./audience";
import {
  CONTACT_EXPERIMENT,
  CONTACT_TEST_DAYS,
  HOTSPOTS,
  type Hotspot,
  PAGES,
  type PageId,
  SIMULATOR_EXPERIMENT,
  SIMULATOR_TEST_DAYS,
  SITE_ORIGIN,
  TRANSITIONS,
} from "./site";

/** The heatmap sampling rate the tracker applied, as declared on pageviews. */
const HEATMAP_SAMPLE_RATE = 0.3;
const MAX_PAGEVIEWS = 14;
const SECOND = 1000;

/** Chance a simulator result leads to the quote form, per arm (control first). */
const SIMULATOR_TO_QUOTE = [0.29, 0.43] as const;
/** Chance a contact visit asks for a call back, per arm, and outside the test. */
const CALLBACK_RATE = [0.11, 0.18] as const;
const CALLBACK_RATE_OUTSIDE_TEST = 0.13;

const SKUS = ["PV-MONO-430", "PV-BIF-540", "INV-HYB-6K", "BAT-10", "EV-WB-11"];
const INTERESTS = ["pv", "pv_battery", "battery", "ev", "business"] as const;

export interface VisitContext {
  rng: Rng;
  visitor: Visitor;
  acquisition: Acquisition;
  start: number;
  now: number;
}

/** What a page did: the events it added and where the visitor goes next. */
interface PageOutcome {
  events: MarketingImportEvent[];
  next?: PageId;
}

const url = (page: PageId, query?: string) =>
  `${SITE_ORIGIN}${PAGES[page][0]}${query ? `?${query}` : ""}`;

const custom = (
  page: PageId,
  at: number,
  name: string,
  data?: MarketingImportEvent["data"],
): MarketingImportEvent => {
  const event: MarketingImportEvent = {
    kind: "custom",
    at,
    url: url(page),
    name,
  };
  if (data) event.data = data;
  return event;
};

const exposure = (
  page: PageId,
  at: number,
  experiment: string,
  variation: string,
): MarketingImportEvent => ({
  kind: "exposure",
  at,
  url: url(page),
  name: experiment,
  data: { experiment, variation },
});

function isSimulatorTestOn(ctx: VisitContext, at: number): boolean {
  return at >= ctx.now - SIMULATOR_TEST_DAYS * DAY_MS;
}

function isContactTestOn(ctx: VisitContext, at: number): boolean {
  return (
    at >= ctx.now - CONTACT_TEST_DAYS.start * DAY_MS &&
    at < ctx.now - CONTACT_TEST_DAYS.stop * DAY_MS
  );
}

function simulator(ctx: VisitContext, t: number): PageOutcome {
  const { rng, visitor } = ctx;
  const events: MarketingImportEvent[] = [];
  const testOn = isSimulatorTestOn(ctx, t);
  if (testOn) {
    events.push(
      exposure(
        "simulator",
        t + 2 * SECOND,
        SIMULATOR_EXPERIMENT,
        visitor.simulatorArm ? "instant-estimate" : "control",
      ),
    );
  }
  if (!rng.chance(0.72)) return { events };
  events.push(custom("simulator", t + 9 * SECOND, "simulator_started"));
  if (!rng.chance(0.68)) return { events };
  const kwp = rng.int(8, 24) / 2;
  events.push(
    custom("simulator", t + rng.int(60, 150) * SECOND, "simulator_completed", {
      kwp,
      battery: rng.chance(0.45),
      orientation: rng.pick(["sud", "sud-est", "sud-ouest", "est-ouest"]),
    }),
  );
  const toQuote = testOn
    ? SIMULATOR_TO_QUOTE[visitor.simulatorArm === 1 ? 1 : 0]
    : SIMULATOR_TO_QUOTE[0];
  return { events, next: rng.chance(toQuote) ? "quote" : undefined };
}

function quote(ctx: VisitContext, t: number): PageOutcome {
  if (!ctx.rng.chance(0.54)) return { events: [] };
  return {
    events: [
      custom("quote", t + ctx.rng.int(90, 240) * SECOND, "quote_requested", {
        interest: ctx.rng.pick(INTERESTS),
      }),
    ],
    next: "quoteSent",
  };
}

function offer(ctx: VisitContext, t: number): PageOutcome {
  if (!ctx.rng.chance(0.36)) return { events: [] };
  return {
    events: [
      custom("offer", t + ctx.rng.int(20, 70) * SECOND, "battery_offer_cta"),
    ],
    next: ctx.rng.chance(0.78) ? "quote" : "simulator",
  };
}

function contact(ctx: VisitContext, t: number): PageOutcome {
  const { rng, visitor } = ctx;
  const events: MarketingImportEvent[] = [];
  let rate = CALLBACK_RATE_OUTSIDE_TEST;
  if (isContactTestOn(ctx, t)) {
    events.push(
      exposure(
        "contact",
        t + 2 * SECOND,
        CONTACT_EXPERIMENT,
        visitor.contactArm ? "short-form" : "control",
      ),
    );
    rate = CALLBACK_RATE[visitor.contactArm === 1 ? 1 : 0];
  }
  if (visitor.device.isMobile && rng.chance(0.14))
    events.push(custom("contact", t + 12 * SECOND, "phone_clicked"));
  if (rng.chance(rate)) {
    events.push(
      custom("contact", t + rng.int(40, 120) * SECOND, "callback_requested", {
        slot: rng.pick(["matin", "après-midi", "soir"]),
      }),
    );
  }
  return { events };
}

function pageOutcome(ctx: VisitContext, page: PageId, t: number): PageOutcome {
  const { rng } = ctx;
  if (page === "simulator") return simulator(ctx, t);
  if (page === "quote") return quote(ctx, t);
  if (page === "offer") return offer(ctx, t);
  if (page === "contact") return contact(ctx, t);
  if (page === "datasheets" && rng.chance(0.45)) {
    return {
      events: [
        custom(page, t + rng.int(15, 60) * SECOND, "datasheet_downloaded", {
          sku: rng.pick(SKUS),
        }),
      ],
    };
  }
  if (page.startsWith("blog") && page !== "blog" && rng.chance(0.03)) {
    return {
      events: [
        custom(page, t + rng.int(60, 200) * SECOND, "newsletter_subscribed"),
      ],
    };
  }
  return { events: [] };
}

function dwellSeconds(rng: Rng, page: PageId): number {
  if (page.startsWith("blog") && page !== "blog") return rng.int(70, 320);
  if (page === "simulator" || page === "quote") return rng.int(90, 260);
  if (page === "home") return rng.int(15, 80);
  return rng.int(20, 130);
}

/** A click on one hotspot, its position jittered inside the element. */
function click(
  rng: Rng,
  page: PageId,
  at: number,
  spot: Hotspot,
): MarketingImportEvent {
  const nth = spot.count ? rng.int(0, spot.count - 1) : 0;
  const shift = spot.count ? (nth - (spot.count - 1) / 2) * 0.16 : 0;
  const jitter = () => (rng.next() - 0.5) * 0.03;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  const x = clamp(spot.x + (spot.axis === "x" ? shift : 0) + jitter());
  const yShift = spot.axis === "y" ? shift * 0.4 : 0;
  return {
    kind: "click",
    at,
    url: url(page),
    data: {
      x,
      y: clamp(spot.y + yShift + jitter()),
      dx: x,
      dy: clamp(spot.dy + yShift * 0.5 + jitter() / 3),
      selector: spot.selector,
      ox: 0.15 + rng.next() * 0.7,
      oy: 0.2 + rng.next() * 0.6,
      nth,
    },
  };
}

/** Scroll depth and clicks of a page load the tracker sampled. */
function heatmapEvents(
  rng: Rng,
  page: PageId,
  t: number,
  dwell: number,
): MarketingImportEvent[] {
  const events: MarketingImportEvent[] = [];
  const spots = HOTSPOTS[page] ?? [];
  const clicks = spots.length ? rng.int(0, 3) : 0;
  for (let i = 0; i < clicks; i++) {
    const spot = rng.weighted(spots.map((s) => [s, s.weight] as const));
    events.push(
      click(rng, page, t + ((i + 1) * dwell * SECOND) / (clicks + 2), spot),
    );
  }
  const depth = Math.min(
    100,
    Math.round(rng.next() * 70 + (dwell > 60 ? 30 : 5)),
  );
  events.push({
    kind: "scroll",
    at: t + dwell * SECOND - 400,
    url: url(page),
    data: { depth },
  });
  return events;
}

function nextPage(rng: Rng, page: PageId): PageId | undefined {
  const next = rng.weighted(TRANSITIONS[page]);
  return next === "exit" ? undefined : next;
}

/**
 * Every event of one visit to the website, in time order, never past `now`,
 * as the tracker would have sent it: pageviews along a plausible path, the
 * custom events of the simulator, the quote form and the offers, the A/B
 * exposures of the tests running at that moment, and the scroll depths and
 * clicks of sampled page loads. Only the landing pageview carries the
 * referrer, since the module reads it there.
 */
export function buildVisit(ctx: VisitContext): MarketingImportEvent[] {
  const { rng, acquisition } = ctx;
  const events: MarketingImportEvent[] = [];
  let page: PageId | undefined = acquisition.landing;
  let t = ctx.start;
  for (let views = 0; page && views < MAX_PAGEVIEWS; views++) {
    const isLanding = views === 0;
    const pageview: MarketingImportEvent = {
      kind: "pageview",
      at: t,
      url: url(page, isLanding ? acquisition.query : undefined),
      title: PAGES[page][1],
      data: { sample: HEATMAP_SAMPLE_RATE },
    };
    if (isLanding && acquisition.referrer)
      pageview.referrer = acquisition.referrer;
    events.push(pageview);
    const outcome = pageOutcome(ctx, page, t);
    const lastAt = Math.max(t, ...outcome.events.map((e) => Number(e.at)));
    const dwell = Math.max(
      dwellSeconds(rng, page),
      Math.ceil((lastAt - t) / SECOND) + 5,
    );
    events.push(...outcome.events);
    if (rng.chance(HEATMAP_SAMPLE_RATE))
      events.push(...heatmapEvents(rng, page, t, dwell));
    t += dwell * SECOND;
    page = outcome.next ?? nextPage(rng, page);
  }
  return events.filter((event) => Number(event.at) < ctx.now - 60 * SECOND);
}
