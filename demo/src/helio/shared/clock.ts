import { createHash, randomBytes, randomUUID } from "node:crypto";

const NOW = process.env.HELIO_NOW;
const FIXED = NOW === undefined || NOW === "" ? undefined : Date.parse(NOW);

if (FIXED !== undefined && Number.isNaN(FIXED))
  throw new Error(`HELIO_NOW must be an ISO 8601 instant, got "${NOW}"`);

/**
 * The instant Helio's fixtures, seeds and pages treat as now, in epoch milliseconds: `HELIO_NOW` (an ISO 8601
 * instant) when it is set, else the real time. Timers, throttles and the simulators keep the real clock.
 */
export function helioNow(): number {
  return FIXED ?? Date.now();
}

/**
 * When the demo counts itself installed: `HELIO_NOW` when it is set, else `stored`, the date the database stamped
 * on the tenant. The stamp is the real time of the boot, so a fixed clock must not read it.
 */
export function helioInstalledAt(stored: Date | number | string): Date {
  return new Date(FIXED ?? stored);
}

const UUID_VERSION_4 = 0x4000;
const UUID_VARIANT_MASK = 0x3fff;
const UUID_VARIANT = 0x8000;

/**
 * An id for a seeded row: a random UUID, or, when `HELIO_NOW` is set, a UUID derived from `name` and that instant,
 * so two runs on an empty database write the same one.
 */
export function helioUuid(name: string): string {
  if (FIXED === undefined) return randomUUID();
  const hex = createHash("sha256")
    .update(`helio-uuid:${NOW}:${name}`)
    .digest("hex");
  const version = (parseInt(hex.slice(12, 16), 16) & 0x0fff) | UUID_VERSION_4;
  const variant =
    (parseInt(hex.slice(16, 20), 16) & UUID_VARIANT_MASK) | UUID_VARIANT;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    version.toString(16),
    variant.toString(16),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * A secret for a seeded row, `bytes` bytes as hex: random, or, when `HELIO_NOW` is set, derived from `name` and that
 * instant, so two runs on an empty database write the same one.
 */
export function helioSecret(name: string, bytes: number): string {
  if (FIXED === undefined) return randomBytes(bytes).toString("hex");
  return createHash("sha256")
    .update(`helio-secret:${NOW}:${name}`)
    .digest("hex")
    .slice(0, bytes * 2);
}
