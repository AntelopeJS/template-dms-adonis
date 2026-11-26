import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** A locale's messages, nested by key segment. */
interface Catalog {
  [segment: string]: Message;
}

type Message = string | Catalog;

const ROOT = resolve(import.meta.dirname, "..");
const BACKEND_SOURCE_DIR = join(ROOT, "..", "src");
const LOCALE_DIR = join(ROOT, "i18n", "locales");
const KEY_LITERAL = /\$(?:demo|helio)\.[\w.]+/g;

function isMessage(value: unknown): value is Message {
  return typeof value === "string" || isCatalog(value);
}

function isCatalog(value: unknown): value is Catalog {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isMessage)
  );
}

function parseCatalog(file: string): Catalog {
  const parsed: unknown = JSON.parse(
    readFileSync(join(LOCALE_DIR, file), "utf8"),
  );
  if (!isCatalog(parsed)) throw new Error(`${file} is not a locale catalog`);
  return parsed;
}

function merge(target: Catalog, source: Catalog): Catalog {
  for (const [key, value] of Object.entries(source)) {
    const current = Object.hasOwn(target, key) ? target[key] : undefined;
    target[key] =
      current !== undefined && !isString(current) && !isString(value)
        ? merge(current, value)
        : value;
  }
  return target;
}

/** Merges every `<name>-<locale>.json` into one catalog, as the loader does. */
function catalog(locale: string): Catalog {
  return readdirSync(LOCALE_DIR)
    .filter((file) => file.endsWith(`-${locale}.json`))
    .sort()
    .reduce<Catalog>((merged, file) => merge(merged, parseCatalog(file)), {});
}

function keysOf(value: Message, prefix = ""): string[] {
  if (isString(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

function backendKeys(): string[] {
  const found = new Set<string>();
  for (const file of typescriptFiles(BACKEND_SOURCE_DIR)) {
    for (const literal of readFileSync(file, "utf8").match(KEY_LITERAL) ?? []) {
      found.add(literal.slice(1).replace(/\.$/, ""));
    }
  }
  return [...found].sort();
}

function resolveKey(root: Catalog, key: string): Message | undefined {
  return key
    .split(".")
    .reduce<Message | undefined>(
      (node, part) =>
        node !== undefined && !isString(node) && Object.hasOwn(node, part)
          ? node[part]
          : undefined,
      root,
    );
}

function isString(message: Message | undefined): message is string {
  return typeof message === "string";
}

/**
 * Fails when the locale catalogs drift: every locale must carry the same key
 * set, and every `$demo.…` or `$helio.…` key the backend under `../src` writes
 * must resolve to a string in each locale. Keys are matched whole, so a key
 * assembled at runtime escapes this check. `pnpm lint` runs it.
 */
function assertLocalesInSync(): void {
  const en = catalog("en-GB");
  const fr = catalog("fr-FR");

  assert.deepEqual(
    keysOf(fr).sort(),
    keysOf(en).sort(),
    "fr-FR and en-GB carry the same key set",
  );

  const keys = backendKeys();
  assert.ok(
    keys.length > 0,
    `No translation key found under ${BACKEND_SOURCE_DIR}`,
  );
  for (const [locale, messages] of [
    ["en-GB", en],
    ["fr-FR", fr],
  ] as const) {
    assert.deepEqual(
      keys.filter((key) => !isString(resolveKey(messages, key))),
      [],
      `${locale} translates every key the backend writes`,
    );
  }
}

assertLocalesInSync();
