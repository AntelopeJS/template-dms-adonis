/** Any value `JSON.parse` can return. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The JSON object of a request body. */
export type JsonObject = Record<string, JsonValue>;

/** Whether a value from a request body or a row is text. */
export function isText(value: unknown): value is string {
  return typeof value === "string";
}

/** Whether a value from a request body or a row is a boolean. */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** Whether a value from a request body or a row is a number. */
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

/** Whether a value from a response or a row is a non-null object (an array is one). */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
