/**
 * What the home page's Prose reads its Markdown into. `marked` only tokenizes
 * here: ProseTokens draws the tokens as Vue nodes itself, so no HTML string is
 * ever produced or injected, raw HTML in the source is dropped, and every link
 * and image address is checked before it reaches an attribute. The parse is
 * synchronous and runs the same on the server and in the browser, so the
 * hydrated page draws what the server sent.
 */
import { decodeHTML } from 'entities'
import { Lexer, type MarkedToken, type Token, type Tokens } from 'marked'

export type ProseHeadingLevel = 2 | 3 | 4

/**
 * How a link of the text is followed: a DMS route in place, an `#anchor` on
 * the page, another site in a new tab, a `mailto:` / `tel:` address by the
 * system.
 */
export type ProseLinkKind = 'internal' | 'anchor' | 'external' | 'contact'

/** The GitHub alert kinds a quote turns into a callout with. */
export type ProseCalloutKind =
	'note' | 'tip' | 'important' | 'warning' | 'caution'

const CALLOUT_KINDS: readonly ProseCalloutKind[] = [
	'note',
	'tip',
	'important',
	'warning',
	'caution',
]

/** A heading token, with the anchor the parse gave it. */
export interface ProseHeadingToken extends Tokens.Heading {
	id: string
	level: ProseHeadingLevel
}

/** A quote opening with `[!KIND]`, its marker taken out. */
export interface ProseCalloutToken extends Tokens.Blockquote {
	callout: ProseCalloutKind
}

const LEXER_OPTIONS = { gfm: true, breaks: false } as const

const CALLOUT_MARKER =
	/^\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i

const MARKED_TOKEN_TYPES = new Set<string>([
	'blockquote',
	'br',
	'checkbox',
	'code',
	'codespan',
	'def',
	'del',
	'em',
	'escape',
	'heading',
	'hr',
	'html',
	'image',
	'link',
	'list',
	'list_item',
	'paragraph',
	'space',
	'strong',
	'table',
	'text',
] satisfies MarkedToken['type'][])

const SCHEME_PATTERN = /^([a-z][a-z\d+.-]*):/i
const SAFE_LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const SAFE_IMAGE_SCHEMES = new Set(['http', 'https'])
const CONTACT_LINK_PATTERN = /^(?:mailto|tel):/i
const EXTERNAL_LINK_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i
/** Characters a browser ignores inside a URL scheme (`java\tscript:`). */
const SPACE_CODE = 0x20
const DELETE_CODE = 0x7f
const LAST_C1_CODE = 0x9f

/** Attributes that open an external link safely in a new tab. */
export const EXTERNAL_LINK_ATTRIBUTES = {
	target: '_blank',
	rel: 'noopener noreferrer',
} as const

/** Drops the control characters and spaces a browser ignores in a URL. */
function stripIgnoredCharacters(url: string): string {
	return Array.from(url)
		.filter((character) => {
			const code = character.codePointAt(0)!
			return code > SPACE_CODE && (code < DELETE_CODE || code > LAST_C1_CODE)
		})
		.join('')
}

/**
 * Whether an address may become a link: `http(s)`, `mailto:`, `tel:`, a path
 * or an `#anchor`. Anything else (`javascript:`, `data:`, `vbscript:`) is
 * refused, entities and ignored characters decoded first.
 */
export function isSafeLinkUrl(href: string): boolean {
	return hasSafeScheme(href, SAFE_LINK_SCHEMES)
}

/** Whether an address may be an image's source: `http(s)` or a path. */
export function isSafeImageUrl(src: string): boolean {
	return hasSafeScheme(src, SAFE_IMAGE_SCHEMES)
}

function hasSafeScheme(url: string, schemes: Set<string>): boolean {
	const normalized = stripIgnoredCharacters(decodeHTML(url))
	if (!normalized) return false
	const scheme = SCHEME_PATTERN.exec(normalized)?.[1]
	return !scheme || schemes.has(scheme.toLowerCase())
}

/**
 * How a link is followed (see {@link ProseLinkKind}). Nothing for an address
 * {@link isSafeLinkUrl} refuses: the text stays, without a link.
 */
export function proseLinkKind(href: string): ProseLinkKind | undefined {
	if (!isSafeLinkUrl(href)) return undefined
	if (CONTACT_LINK_PATTERN.test(href.trim())) return 'contact'
	if (href.startsWith('#')) return 'anchor'
	return EXTERNAL_LINK_PATTERN.test(href) ? 'external' : 'internal'
}

/** A token's text without its Markdown: what a heading reads as. */
function plainText(tokens: Token[] | undefined): string {
	return (tokens ?? [])
		.map((token) => {
			if ('tokens' in token && token.tokens) return plainText(token.tokens)
			if (token.type === 'html' || token.type === 'checkbox') return ''
			return 'text' in token ? decodeHTML(String(token.text)) : ''
		})
		.join('')
}

/**
 * The anchor of a heading: lower case, accents dropped, words joined by
 * dashes ("Les accès" → `les-acces`).
 */
export function slugify(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z\d]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

const SECTION_FALLBACK_SLUG = 'section'

function clampLevel(depth: number): ProseHeadingLevel {
	if (depth <= 2) return 2
	return depth === 3 ? 3 : 4
}

/** Whether a token is one of marked's own, not an extension's. */
export function isMarkedToken(token: Token): token is MarkedToken {
	return MARKED_TOKEN_TYPES.has(token.type)
}

function isCalloutKind(value: unknown): value is ProseCalloutKind {
	return CALLOUT_KINDS.some((kind) => kind === value)
}

/** Whether a heading is one {@link parseProse} anchored. */
export function isProseHeading(token: Token): token is ProseHeadingToken {
	return (
		token.type === 'heading' &&
		'id' in token &&
		typeof token.id === 'string' &&
		'level' in token &&
		(token.level === 2 || token.level === 3 || token.level === 4)
	)
}

/** Whether a quote is one {@link parseProse} turned into a callout. */
export function isProseCallout(token: Token): token is ProseCalloutToken {
	return (
		token.type === 'blockquote' &&
		'callout' in token &&
		isCalloutKind(token.callout)
	)
}

function calloutOf(token: Tokens.Blockquote): ProseCalloutToken | undefined {
	const marker = CALLOUT_MARKER.exec(token.text)
	const callout = marker?.[1]?.toLowerCase()
	if (!marker || !isCalloutKind(callout)) return undefined
	return {
		...token,
		callout,
		tokens: new Lexer(LEXER_OPTIONS).lex(token.text.slice(marker[0].length)),
	}
}

/**
 * Reads Markdown into tokens: headings get a unique anchor and are clamped
 * to levels 2 – 4 (a `#` heading is drawn as a `##`, the page already has
 * its title), and `> [!KIND]` quotes become callouts.
 */
export function parseProse(markdown: string): Token[] {
	const usedIds = new Map<string, number>()

	function uniqueId(text: string): string {
		const base = slugify(text) || SECTION_FALLBACK_SLUG
		const count = usedIds.get(base) ?? 0
		usedIds.set(base, count + 1)
		return count ? `${base}-${count + 1}` : base
	}

	function visit(tokens: Token[]): Token[] {
		return tokens.map((token): Token => {
			if (!isMarkedToken(token)) return token
			if (token.type === 'heading') {
				const id = uniqueId(plainText(token.tokens))
				const level = clampLevel(token.depth)
				return { ...token, id, level } satisfies ProseHeadingToken
			}
			if (token.type === 'blockquote') {
				const quote = calloutOf(token) ?? token
				return { ...quote, tokens: visit(quote.tokens) }
			}
			if (token.type === 'list') {
				const items = token.items.map((item) => ({
					...item,
					tokens: visit(item.tokens),
				}))
				return { ...token, items }
			}
			return token
		})
	}

	return visit(new Lexer(LEXER_OPTIONS).lex(markdown))
}
