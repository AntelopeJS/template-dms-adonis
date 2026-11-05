import type { TicketCategory, TicketPriority } from "../../service/database";
import { isObject, isText, type JsonValue } from "../../shared/json";

/** What a monitoring alert opens a ticket as. */
export interface AlertKind {
  category: TicketCategory;
  subject: string;
}

const ALERT_KINDS = new Map<string, AlertKind>([
  [
    "inverter_offline",
    { category: "inverter_error", subject: "onduleur hors ligne" },
  ],
  [
    "string_fault",
    {
      category: "inverter_error",
      subject: "défaut sur une chaîne de panneaux",
    },
  ],
  [
    "low_production",
    { category: "no_production", subject: "production anormalement basse" },
  ],
  [
    "communication_lost",
    { category: "monitoring", subject: "perte de communication" },
  ],
]);
const DEFAULT_ALERT: AlertKind = {
  category: "monitoring",
  subject: "anomalie détectée",
};

const PRIORITY_BY_SEVERITY = new Map<string, TicketPriority>([
  ["critical", "urgent"],
  ["warning", "high"],
  ["info", "normal"],
]);

/**
 * The property key a webhook value used to be looked up by in the tables: text
 * as is, an array as its items joined with commas, a number or a boolean as
 * written, `null` as nothing, an object as `[object Object]`. An object with a
 * `toString` key of its own has no primitive form, so the lookup refuses it as
 * a property key does.
 */
function keyOf(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (isText(value)) return value;
  if (Array.isArray(value)) return value.map(keyOf).join(",");
  if (isObject(value)) {
    if (Object.getOwnPropertyDescriptor(value, "toString")) {
      throw new TypeError("Cannot convert object to primitive value");
    }
    return "[object Object]";
  }
  return String(value);
}

/** The kind of ticket an alert named `alert` opens; a generic one when unknown. */
export function alertKindOf(alert: JsonValue | undefined): AlertKind {
  return ALERT_KINDS.get(keyOf(alert)) ?? DEFAULT_ALERT;
}

/** The priority of a ticket opened for an alert of `severity`; normal when unknown. */
export function priorityOf(severity: JsonValue | undefined): TicketPriority {
  return PRIORITY_BY_SEVERITY.get(keyOf(severity)) ?? "normal";
}
