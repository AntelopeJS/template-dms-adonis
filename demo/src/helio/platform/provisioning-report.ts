/** What the backend logs once Helio's default-tenant provisioning ran every step. */
export const PROVISIONING_DONE = "Helio provisioning is done";

/** What the backend logs, followed by the failed steps, when a step of Helio's default-tenant provisioning failed. */
export const PROVISIONING_INCOMPLETE = "Helio provisioning is incomplete";

/** How Helio's default-tenant provisioning ended. */
export type ProvisioningOutcome = "done" | "incomplete";

/** The outcome a backend log line reports, or `undefined` for any other line. */
export function provisioningOutcome(
  line: string,
): ProvisioningOutcome | undefined {
  if (line.includes(PROVISIONING_DONE)) return "done";
  if (line.includes(PROVISIONING_INCOMPLETE)) return "incomplete";
  return undefined;
}
