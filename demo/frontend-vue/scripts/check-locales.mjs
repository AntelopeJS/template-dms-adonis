/**
 * Fails when the locale catalogs drift: every locale must carry the same key
 * set, and every `$demo.…` or `$helio.…` key the backend under `../src` writes
 * must resolve to a string in each locale. Keys are matched whole, so a key
 * assembled at runtime escapes this check. `pnpm lint` runs it.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_SOURCE_DIR = join(ROOT, '..', 'src')
const LOCALE_DIR = join(ROOT, 'i18n', 'locales')
const KEY_LITERAL = /\$(?:demo|helio)\.[\w.]+/g

function isCatalog(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function merge(target, source) {
	for (const [key, value] of Object.entries(source)) {
		const current = target[key]
		target[key] =
			isCatalog(current) && isCatalog(value) ? merge(current, value) : value
	}
	return target
}

/** Merges every `<name>-<locale>.json` into one catalog, as the loader does. */
function catalog(locale) {
	return readdirSync(LOCALE_DIR)
		.filter((file) => file.endsWith(`-${locale}.json`))
		.sort()
		.reduce(
			(merged, file) =>
				merge(merged, JSON.parse(readFileSync(join(LOCALE_DIR, file), 'utf8'))),
			{},
		)
}

function keysOf(value, prefix = '') {
	if (!isCatalog(value)) return [prefix]
	return Object.entries(value).flatMap(([key, child]) =>
		keysOf(child, prefix ? `${prefix}.${key}` : key),
	)
}

function typescriptFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) return typescriptFiles(path)
		return entry.isFile() && path.endsWith('.ts') ? [path] : []
	})
}

function backendKeys() {
	const found = new Set()
	for (const file of typescriptFiles(BACKEND_SOURCE_DIR)) {
		for (const literal of readFileSync(file, 'utf8').match(KEY_LITERAL) ?? []) {
			found.add(literal.slice(1).replace(/\.$/, ''))
		}
	}
	return [...found].sort()
}

function resolveKey(root, key) {
	return key
		.split('.')
		.reduce((node, part) => (isCatalog(node) ? node[part] : undefined), root)
}

const en = catalog('en-GB')
const fr = catalog('fr-FR')

assert.deepEqual(
	keysOf(fr).sort(),
	keysOf(en).sort(),
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
]) {
	assert.deepEqual(
		keys.filter((key) => typeof resolveKey(messages, key) !== 'string'),
		[],
		`${locale} translates every key the backend writes`,
	)
}
