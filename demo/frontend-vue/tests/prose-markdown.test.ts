import { describe, expect, it } from 'vitest'
import type { Token } from 'marked'
import {
	isSafeImageUrl,
	isSafeLinkUrl,
	parseProse,
	proseLinkKind,
	slugify,
} from '../app/prose/markdown'

const headings = (tokens: Token[]) =>
	tokens
		.filter((token) => token.type === 'heading')
		.map((token) => {
			const { id, level } = token as Token & { id: string; level: number }
			return { id, level }
		})

describe('parseProse', () => {
	it('anchors each heading once, clamped to levels 2 to 4', () => {
		const tokens = parseProse(
			'# Getting started\n\n## Les accès\n\n### Getting started\n\n##### Deep',
		)

		expect(headings(tokens)).toEqual([
			{ id: 'getting-started', level: 2 },
			{ id: 'les-acces', level: 2 },
			{ id: 'getting-started-2', level: 3 },
			{ id: 'deep', level: 4 },
		])
	})

	it('anchors a heading on its text without its Markdown', () => {
		const tokens = parseProse('## The **`id`** field &amp; more')

		expect(headings(tokens)[0]?.id).toBe('the-id-field-more')
	})

	it('turns a [!KIND] quote into a callout, its marker taken out', () => {
		const tokens = parseProse('> [!WARNING]\n> Back up **first**.')

		expect(tokens[0]).toMatchObject({ type: 'blockquote', callout: 'warning' })
		const quote = tokens[0] as { tokens: unknown[] }
		expect(JSON.stringify(quote.tokens)).not.toContain('[!WARNING]')
	})

	it('leaves a plain quote a quote', () => {
		const tokens = parseProse('> Just a quote')

		expect(tokens[0]).not.toHaveProperty('callout')
	})
})

describe('link and image addresses', () => {
	it.each([
		'https://example.com',
		'http://example.com',
		'mailto:ada@example.com',
		'tel:+3212345678',
		'/orders/orders-list',
		'orders',
		'#install',
		'../guide',
	])('accepts %s as a link', (href) => {
		expect(isSafeLinkUrl(href)).toBe(true)
	})

	it.each([
		'javascript:alert(1)',
		'JAVASCRIPT:alert(1)',
		'java\tscript:alert(1)',
		' javascript:alert(1)',
		'javascript&#58;alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox',
		'',
	])('refuses %j as a link', (href) => {
		expect(isSafeLinkUrl(href)).toBe(false)
	})

	it('only takes web addresses and paths as images', () => {
		expect(isSafeImageUrl('https://cdn.example.com/a.png')).toBe(true)
		expect(isSafeImageUrl('/files/a.png')).toBe(true)
		expect(isSafeImageUrl('data:image/svg+xml,<svg/>')).toBe(false)
		expect(isSafeImageUrl('javascript:alert(1)')).toBe(false)
	})

	it('follows each kind of link its own way', () => {
		expect(proseLinkKind('/orders')).toBe('internal')
		expect(proseLinkKind('#install')).toBe('anchor')
		expect(proseLinkKind('https://example.com')).toBe('external')
		expect(proseLinkKind('mailto:ada@example.com')).toBe('contact')
		expect(proseLinkKind('tel:+3212345678')).toBe('contact')
		expect(proseLinkKind('javascript:alert(1)')).toBeUndefined()
	})
})

describe('slugify', () => {
	it('drops accents and joins words with dashes', () => {
		expect(slugify("  Étape 2 : l'import ")).toBe('etape-2-l-import')
	})
})
