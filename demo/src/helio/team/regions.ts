import { teamIdsByRole } from "../shared/roster";
import { buildTeamMembers } from "./fixtures";

/**
 * Where a member works: the region of the team table. The project and ticket
 * fixtures send the technicians of the customer's region first, so a crew from
 * Liège does not drive to Tournai while the Hainaut technician stays idle.
 */
export type TeamRegion =
  | "liege"
  | "namur"
  | "brussels"
  | "hainaut"
  | "luxembourg";

/**
 * The region of each province of a customer's address. Walloon Brabant has no
 * technician of its own: Brussels covers it.
 */
const PROVINCE_REGION = new Map<string, TeamRegion>([
  ["Liège", "liege"],
  ["Namur", "namur"],
  ["Hainaut", "hainaut"],
  ["Luxembourg", "luxembourg"],
  ["Bruxelles-Capitale", "brussels"],
  ["Brabant wallon", "brussels"],
]);

/** The region covering a Belgian province; Liège, the head office, else. */
export function regionOfProvince(province: string | undefined): TeamRegion {
  return PROVINCE_REGION.get(province ?? "") ?? "liege";
}

let regions: Map<string, string> | undefined;

/** The region a team member works in. */
export function memberRegion(memberId: string): string | undefined {
  regions ??= new Map(
    buildTeamMembers().map((member) => [member._id, member.region]),
  );
  return regions.get(memberId);
}

/** The technicians based in a region (possibly none). */
export function techniciansOf(region: string): string[] {
  return teamIdsByRole("technician").filter(
    (id) => memberRegion(id) === region,
  );
}
