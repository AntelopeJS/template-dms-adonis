/**
 * Fails when the locale catalogs drift: every locale must carry the same key
 * set, and every `$demo.…` or `$helio.…` key the backend under `../src` writes
 * must resolve to a string in each locale. Keys are matched whole, so a key
 * assembled at runtime escapes this check. `pnpm lint` runs it.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** A locale catalog: each key holds a message or a nested catalog. */
type Catalog = Map<string, CatalogEntry>

/** What a catalog key holds. */
type CatalogEntry = string | Catalog

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND_SOURCE_DIR = join(ROOT, '..', 'src')
const LOCALE_DIR = join(ROOT, 'i18n', 'locales')
const KEY_LITERAL = /\$(?:demo|helio)\.[\w.]+/g

/** A catalog file's JSON: nested objects of messages. */
interface CatalogJson {
	readonly [key: string]: string | CatalogJson
}

function isMessage(value: unknown): value is string {
	return typeof value === 'string'
}

function isCatalogJson(value: unknown): value is CatalogJson {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every(
			(child) => isMessage(child) || isCatalogJson(child),
		)
	)
}

function toCatalog(json: CatalogJson): Catalog {
	return new Map(
		Object.entries(json).map(([key, child]): [string, CatalogEntry] => [
			key,
			isMessage(child) ? child : toCatalog(child),
		]),
	)
}

function merge(target: Catalog, source: Catalog): Catalog {
	for (const [key, value] of source) {
		const current = target.get(key)
		target.set(
			key,
			current instanceof Map && value instanceof Map
				? merge(current, value)
				: value,
		)
	}
	return target
}

function readCatalog(file: string): Catalog {
	const json: unknown = JSON.parse(readFileSync(join(LOCALE_DIR, file), 'utf8'))
	assert.ok(isCatalogJson(json), `${file} holds something else than messages`)
	return toCatalog(json)
}

/** Merges every `<name>-<locale>.json` into one catalog, as the loader does. */
function catalog(locale: string): Catalog {
	return readdirSync(LOCALE_DIR)
		.filter((file) => file.endsWith(`-${locale}.json`))
		.sort((left, right) => left.localeCompare(right))
		.reduce<Catalog>(
			(merged, file) => merge(merged, readCatalog(file)),
			new Map(),
		)
}

function keysOf(entry: CatalogEntry, prefix = ''): string[] {
	if (!(entry instanceof Map)) return [prefix]
	return [...entry].flatMap(([key, child]) =>
		keysOf(child, prefix ? `${prefix}.${key}` : key),
	)
}

function typescriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) return typescriptFiles(path)
		return entry.isFile() && path.endsWith('.ts') ? [path] : []
	})
}

function backendKeys(): string[] {
	const found = new Set<string>()
	for (const file of typescriptFiles(BACKEND_SOURCE_DIR)) {
		for (const literal of readFileSync(file, 'utf8').match(KEY_LITERAL) ?? []) {
			found.add(literal.slice(1).replace(/\.$/, ''))
		}
	}
	return [...found].sort((left, right) => left.localeCompare(right))
}

function resolveKey(root: Catalog, key: string): CatalogEntry | undefined {
	return key
		.split('.')
		.reduce<CatalogEntry | undefined>(
			(node, part) => (node instanceof Map ? node.get(part) : undefined),
			root,
		)
}

function isTranslated(entry: CatalogEntry | undefined): entry is string {
	return typeof entry === 'string'
}

const en = catalog('en-GB')
const fr = catalog('fr-FR')

assert.deepEqual(
	keysOf(fr).sort((left, right) => left.localeCompare(right)),
	keysOf(en).sort((left, right) => left.localeCompare(right)),
	'fr-FR and en-GB carry the same key set',
)

const keys = backendKeys()
assert.ok(
	keys.length > 0,
	`No translation key found under ${BACKEND_SOURCE_DIR}`,
)
for (const [locale, messages] of [
	['en-GB', en],
	['fr-FR', fr],
] as const) {
	assert.deepEqual(
		keys.filter((key) => !isTranslated(resolveKey(messages, key))),
		[],
		`${locale} translates every key the backend writes`,
	)
}
