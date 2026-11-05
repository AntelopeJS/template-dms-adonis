import type { Rng } from "../../shared/seed";
import type { PageId } from "./site";

/** A kind of device and browser a visitor browses with. */
export interface Device {
  userAgent: string;
  screens: readonly string[];
  isMobile: boolean;
}

const DEVICES: ReadonlyArray<readonly [Device, number]> = [
  [
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      screens: ["1920x1080", "1536x864", "1366x768"],
      isMobile: false,
    },
    22,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
      screens: ["1920x1080", "1536x864"],
      isMobile: false,
    },
    8,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
      screens: ["1920x1080", "2560x1440"],
      isMobile: false,
    },
    4,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      screens: ["1440x900", "1512x982"],
      isMobile: false,
    },
    7,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      screens: ["1440x900", "1728x1117"],
      isMobile: false,
    },
    4,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
      screens: ["1920x1080"],
      isMobile: false,
    },
    1,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      screens: ["390x844", "393x852", "430x932"],
      isMobile: true,
    },
    25,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
      screens: ["412x915", "360x780"],
      isMobile: true,
    },
    17,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      screens: ["384x854"],
      isMobile: true,
    },
    4,
  ],
  [
    {
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
      screens: ["820x1180", "1024x1366"],
      isMobile: false,
    },
    4,
  ],
];

const LOCALES: ReadonlyArray<
  readonly [readonly [country: string, language: string], number]
> = [
  [["BE", "fr-BE"], 66],
  [["BE", "nl-BE"], 13],
  [["BE", "en-GB"], 3],
  [["BE", "de-BE"], 2],
  [["FR", "fr-FR"], 7],
  [["NL", "nl-NL"], 4],
  [["LU", "fr-LU"], 4],
  [["DE", "de-DE"], 1],
];

/**
 * A visitor to Helio's website. Devices and browsers are those of a Belgian
 * audience, and the countries are those around Liège.
 */
export interface Visitor {
  key: string;
  device: Device;
  screen: string;
  country: string;
  language: string;
  /** Arms of the two A/B tests this visitor draws, 0 = control. */
  simulatorArm: number;
  contactArm: number;
}

export function newVisitor(rng: Rng, index: number): Visitor {
  const device = rng.weighted(DEVICES);
  const [country, language] = rng.weighted(LOCALES);
  return {
    key: `helio-v${index}`,
    device,
    screen: rng.pick(device.screens),
    country,
    language,
    simulatorArm: rng.chance(0.5) ? 1 : 0,
    contactArm: rng.chance(0.5) ? 1 : 0,
  };
}

/** How a visit started: its landing page, referrer and campaign parameters. */
export interface Acquisition {
  landing: PageId;
  referrer?: string;
  /** Query string of the landing URL (UTM, ad click id), without "?". */
  query?: string;
}

export type Channel =
  | "organic"
  | "direct"
  | "social"
  | "referral"
  | "email"
  | "paid"
  | "offline";

/**
 * Days (before now) of the campaigns the team ran over the last three months,
 * so traffic follows the calendar.
 */
export const CAMPAIGNS = {
  autumnBattery: { start: 24, end: 0 },
  newsletters: [
    { day: 52, campaign: "newsletter-septembre" },
    { day: 21, campaign: "newsletter-octobre" },
  ],
  fair: { start: 40, end: 37 },
} as const;

const ORGANIC_LANDINGS: ReadonlyArray<readonly [PageId, number]> = [
  ["home", 24],
  ["pv", 16],
  ["blogPrime", 14],
  ["blogProsumer", 12],
  ["blogOrientation", 8],
  ["blogEv", 5],
  ["battery", 8],
  ["ev", 5],
  ["simulator", 5],
  ["business", 3],
];
const DIRECT_LANDINGS: ReadonlyArray<readonly [PageId, number]> = [
  ["home", 60],
  ["simulator", 12],
  ["contact", 8],
  ["projects", 8],
  ["quote", 6],
  ["datasheets", 6],
];
const SOCIAL_LANDINGS: ReadonlyArray<readonly [PageId, number]> = [
  ["projectCase", 22],
  ["blogPrime", 20],
  ["projects", 16],
  ["home", 14],
  ["blogEv", 10],
  ["offer", 18],
];
const REFERRERS: ReadonlyArray<readonly [readonly [string, PageId], number]> = [
  [["https://www.comparateur-energie.example/installateurs/liege", "home"], 30],
  [
    ["https://forum.renover-wallonie.example/t/panneaux-solaires-avis", "pv"],
    22,
  ],
  [["https://www.cciliege.example/membres", "business"], 10],
  [
    [
      "https://lameuse-actu.example/economie/batteries-domestiques",
      "blogPrime",
    ],
    18,
  ],
  [["https://www.mon-garage-ve.example/bornes", "ev"], 10],
  [["https://mail.google.com/", "quote"], 10],
];

function organic(rng: Rng): Acquisition {
  const engine = rng.weighted([
    ["https://www.google.com/", 84],
    ["https://www.bing.com/", 8],
    ["https://duckduckgo.com/", 4],
    ["https://www.ecosia.org/", 4],
  ] as const);
  return { landing: rng.weighted(ORGANIC_LANDINGS), referrer: engine };
}

function social(rng: Rng): Acquisition {
  const referrer = rng.weighted([
    ["https://www.facebook.com/", 48],
    ["https://l.instagram.com/", 22],
    ["https://www.linkedin.com/", 22],
    ["https://www.youtube.com/", 8],
  ] as const);
  return { landing: rng.weighted(SOCIAL_LANDINGS), referrer };
}

function referral(rng: Rng): Acquisition {
  const [referrer, landing] = rng.weighted(REFERRERS);
  return { landing, referrer };
}

function paid(rng: Rng, day: number): Acquisition {
  const campaignOn = day <= CAMPAIGNS.autumnBattery.start;
  const clickId = `gclid=Cj0KCQjw${rng.int(100000, 999999)}`;
  if (campaignOn && rng.chance(0.7)) {
    return rng.chance(0.65)
      ? {
          landing: "offer",
          referrer: "https://www.google.com/",
          query: `utm_source=google&utm_medium=cpc&utm_campaign=offre-automne-batterie&utm_term=batterie%20domestique&${clickId}`,
        }
      : {
          landing: "offer",
          referrer: "https://www.facebook.com/",
          query:
            "utm_source=facebook&utm_medium=paid_social&utm_campaign=offre-automne-batterie&utm_content=carrousel",
        };
  }
  return {
    landing: "home",
    referrer: "https://www.google.com/",
    query: `utm_source=google&utm_medium=cpc&utm_campaign=marque-helio&${clickId}`,
  };
}

function email(rng: Rng, day: number): Acquisition {
  const sent =
    CAMPAIGNS.newsletters.find((n) => day <= n.day && day > n.day - 6) ??
    CAMPAIGNS.newsletters[1];
  const landing: PageId =
    sent.campaign === "newsletter-octobre"
      ? rng.pick(["offer", "offer", "blogPrime"])
      : rng.pick(["blogProsumer", "projectCase", "simulator"]);
  return {
    landing,
    query: `utm_source=newsletter&utm_medium=email&utm_campaign=${sent.campaign}`,
  };
}

function offline(rng: Rng): Acquisition {
  return {
    landing: rng.pick(["simulator", "home"]),
    query:
      "utm_source=salon-energie-namur&utm_medium=qr&utm_campaign=salon-energie-2026",
  };
}

/** Relative weight of each channel on a given day (days before now). */
export function channelWeights(
  day: number,
): ReadonlyArray<readonly [Channel, number]> {
  const campaignOn = day <= CAMPAIGNS.autumnBattery.start;
  const newsletter = CAMPAIGNS.newsletters.find(
    (n) => day <= n.day && day > n.day - 6,
  );
  const fairOn = day <= CAMPAIGNS.fair.start && day >= CAMPAIGNS.fair.end;
  return [
    ["organic", 38],
    ["direct", 22],
    ["social", 8],
    ["referral", 9],
    ["paid", campaignOn ? 22 : 5],
    ["email", newsletter ? 26 - (newsletter.day - day) * 4 : 1],
    ["offline", fairOn ? 12 : 0.3],
  ];
}

export function acquire(rng: Rng, channel: Channel, day: number): Acquisition {
  if (channel === "organic") return organic(rng);
  if (channel === "social") return social(rng);
  if (channel === "referral") return referral(rng);
  if (channel === "paid") return paid(rng, day);
  if (channel === "email") return email(rng, day);
  if (channel === "offline") return offline(rng);
  return { landing: rng.weighted(DIRECT_LANDINGS) };
}
