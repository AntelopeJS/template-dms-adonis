import type { InstallationType } from "../sales/lines";
import { teamIdsByRole } from "../shared/roster";
import type { Rng } from "../shared/seed";
import { memberRegion, regionOfProvince } from "../team/regions";

/**
 * The after-sales technician runs the service desk, so it joins a site only
 * when nobody else is free.
 */
const AFTER_SALES = "team-09";
/** The technicians in the order they are picked, after-sales last. */
const TECHNICIANS = [
  ...teamIdsByRole("technician").filter((id) => id !== AFTER_SALES),
  AFTER_SALES,
];
/** The technicians who lead a site by default: all but after-sales. */
const INSTALLERS = TECHNICIANS.filter((id) => id !== AFTER_SALES);

/** The usual partner of each team member, who joins a site first. */
const PARTNERS: ReadonlyMap<string, string> = new Map([
  ["team-05", "team-06"],
  ["team-06", "team-05"],
  ["team-07", "team-08"],
  ["team-08", "team-07"],
  ["team-09", "team-10"],
  ["team-10", "team-07"],
]);

/** The regions a region's technicians are sent to next when all are busy. */
const NEIGHBOURS: ReadonlyMap<string, string[]> = new Map([
  ["liege", ["namur", "luxembourg"]],
  ["namur", ["liege", "luxembourg", "hainaut"]],
  ["luxembourg", ["namur", "liege"]],
  ["hainaut", ["brussels", "namur"]],
  ["brussels", ["hainaut", "namur"]],
]);

/** What a site needs from the planner. */
export interface CrewRequest {
  province: string | undefined;
  type: InstallationType;
  start: Date;
  end: Date;
  /** A paused project keeps its people but books no day. */
  books: boolean;
}

/** The people assigned to a site. */
export interface Crew {
  leadTechnician: string;
  crew: string[];
}

interface Booking {
  from: number;
  to: number;
}

/**
 * Books technicians on sites without overlaps, in the order asked: the lead is
 * one of the customer's region whenever one is free, the crew is the lead's
 * usual partner first, and nobody is booked on two sites the same day.
 */
export class CrewPlanner {
  private readonly bookings = new Map<string, Booking[]>();

  constructor(private readonly rng: Rng) {}

  /**
   * The lead and crew of a site, booked on its days. Strict, it answers
   * undefined when not enough technicians are free (the caller then tries
   * other days); otherwise the least booked fill the gaps.
   */
  assign(request: CrewRequest, strict = false): Crew | undefined {
    const span = { from: request.start.getTime(), to: request.end.getTime() };
    const size = request.type === "commercial_pv" ? this.rng.int(1, 2) : 1;
    const lead = this.pickLead(request.province, span);
    const crew = lead ? this.pickCrew(lead, size, span) : [];
    if (strict && (!lead || crew.length < size)) return undefined;
    const leadTechnician = lead ?? this.leastBooked([]);
    const team =
      crew.length > 0
        ? crew
        : [PARTNERS.get(leadTechnician) ?? this.leastBooked([leadTechnician])];
    if (request.books) {
      for (const id of [leadTechnician, ...team]) this.book(id, span);
    }
    return { leadTechnician, crew: team };
  }

  private isFree(id: string, span: Booking): boolean {
    return (this.bookings.get(id) ?? []).every(
      (booking) => booking.to < span.from || booking.from > span.to,
    );
  }

  private book(id: string, span: Booking): void {
    this.bookings.set(id, [...(this.bookings.get(id) ?? []), span]);
  }

  private leastBooked(except: string[]): string {
    const load = (id: string) => this.bookings.get(id)?.length ?? 0;
    const pool = TECHNICIANS.filter((id) => !except.includes(id));
    return [...pool].sort((a, b) => load(a) - load(b))[0] ?? "";
  }

  /**
   * A free installer of the customer's region first, then of its neighbours,
   * then anyone free (the after-sales technician last).
   */
  private pickLead(
    province: string | undefined,
    span: Booking,
  ): string | undefined {
    const region = regionOfProvince(province);
    for (const area of [region, ...(NEIGHBOURS.get(region) ?? [])]) {
      const free = INSTALLERS.filter(
        (id) => memberRegion(id) === area && this.isFree(id, span),
      );
      if (free.length > 0) return this.rng.pick(free);
    }
    return TECHNICIANS.find((id) => this.isFree(id, span));
  }

  /** The lead's usual partner first, then whoever is free. */
  private pickCrew(lead: string, size: number, span: Booking): string[] {
    const partner = PARTNERS.get(lead);
    const candidates = [
      ...(partner ? [partner] : []),
      ...TECHNICIANS.filter((id) => id !== lead && id !== partner),
    ];
    return candidates.filter((id) => this.isFree(id, span)).slice(0, size);
  }
}
