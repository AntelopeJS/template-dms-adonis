import type { RequestContext } from "@antelopejs/interface-api";
import type { DataControllerCallback } from "@antelopejs/interface-data-api";
import type { Parameters } from "@antelopejs/interface-data-api/components";
import {
  isBoolean,
  isNumber,
  isObject,
  isText,
  type JsonObject,
  type JsonValue,
} from "./json";

/**
 * Whether a parsed body is a JSON object, with JSON data all the way down. It
 * walks the tree with a stack rather than recursion, so a deeply nested body
 * cannot overflow the call stack.
 */
function isJsonObject(value: unknown): value is JsonObject {
  if (!isObject(value) || Array.isArray(value)) return false;
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (isObject(next)) {
      for (const item of Object.values(next)) pending.push(item);
    } else if (
      next !== null &&
      !isText(next) &&
      !isNumber(next) &&
      !isBoolean(next)
    ) {
      return false;
    }
  }
  return true;
}

/** The JSON object a `new` or `edit` request sent, or undefined. */
export function readBody(raw: Buffer | string): JsonObject | undefined {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  if (!text) return undefined;
  const parsed: unknown = JSON.parse(text);
  return isJsonObject(parsed)
    ? Object.fromEntries(Object.entries(parsed))
    : undefined;
}

/** The text a body field holds, or undefined when it holds anything else. */
export function textOf(value: JsonValue | undefined): string | undefined {
  return isText(value) ? value : undefined;
}

/** Whether a body leaves a field empty (0 and false are values). */
export const isBlank = (value: JsonValue | undefined): boolean =>
  value === undefined || value === null || value === "";

/**
 * A data API route whose body gets the values `fill` writes in before the
 * route runs. A guard only gets a parsed copy of the body, so defaults that
 * need the database (the next number, the settings) are written here and the
 * amended object is handed on (the data API takes a parsed body since
 * interface-data-api#43); the route's permission check, guard and
 * validation then see them as sent.
 */
export function withBodyDefaults(
  route: DataControllerCallback,
  fill: (body: JsonObject) => Promise<void>,
): DataControllerCallback {
  return {
    ...route,
    func: async function (
      this: unknown,
      ctx: RequestContext,
      params: Parameters.NewParameters,
      raw: Buffer | string,
      ...rest: unknown[]
    ) {
      const body = readBody(raw);
      if (!body) {
        const untouched: unknown = route.func.call(
          this,
          ctx,
          params,
          raw,
          ...rest,
        );
        return untouched;
      }
      await fill(body);
      const created: unknown = route.func.call(
        this,
        ctx,
        params,
        body,
        ...rest,
      );
      return created;
    },
  };
}
