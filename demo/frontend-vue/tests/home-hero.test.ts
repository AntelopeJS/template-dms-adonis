import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type App, createApp, h } from 'vue'
import HomeHero from '../app/components/HomeHero.vue'
import { splitHeadline } from '../app/utils/heroHeadline'

let app: App | undefined
let host: HTMLDivElement

async function mount(props: Record<string, unknown>) {
	app = createApp({ setup: () => () => h(HomeHero, props) })
	app.component('UIcon', (_, { attrs }) =>
		h('i', { ...attrs, 'data-stub': 'UIcon' }),
	)
	app.component('UButton', (_, { attrs }) =>
		h('a', { ...attrs, 'data-stub': 'UButton' }),
	)
	app.mount(host)
	await new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
	vi.stubGlobal('useTranslation', () => ({
		processI18n: (key: string) =>
			key.startsWith('$') ? `t:${key.slice(1)}` : key,
	}))
	host = document.createElement('div')
	document.body.append(host)
})

afterEach(() => {
	app?.unmount()
	app = undefined
	host.remove()
	vi.unstubAllGlobals()
})

describe('splitHeadline', () => {
	it('highlights the first occurrence of the highlight', () => {
		expect(splitHeadline('Built in a day, in a day.', 'in a day')).toEqual([
			{ text: 'Built ', isHighlighted: false },
			{ text: 'in a day', isHighlighted: true },
			{ text: ', in a day.', isHighlighted: false },
		])
	})

	it('keeps a headline without its highlight as one run', () => {
		expect(splitHeadline('Built today', 'in a day')).toEqual([
			{ text: 'Built today', isHighlighted: false },
		])
	})
})

describe('HomeHero', () => {
	it('draws its translated texts, highlight, actions and icons', async () => {
		await mount({
			eyebrow: '$home.eyebrow',
			title: 'A platform built in a day.',
			highlight: 'in a day',
			lead: '$home.lead',
			icons: ['i-ph-sun', 'i-ph-squares-four', 'i-ph-lightning', 'i-ph-extra'],
			actions: [
				{ label: '$home.open', to: '/helio/dashboard' },
				{ label: 'Docs', to: 'https://dms.antelopejs.com/docs' },
			],
		})

		const section = host.querySelector('section')!
		expect(section.querySelector('p')?.textContent?.trim()).toBe(
			't:home.eyebrow',
		)
		const title = section.querySelector('h2')!
		expect(section.getAttribute('aria-labelledby')).toBe(title.id)
		expect(title.querySelector('.text-primary')?.textContent?.trim()).toBe(
			'in a day',
		)
		expect(section.textContent).toContain('t:home.lead')

		const [open, docs] = section.querySelectorAll('[data-stub=UButton]')
		expect(open?.getAttribute('label')).toBe('t:home.open')
		expect(open?.getAttribute('to')).toBe('/helio/dashboard')
		expect(open?.getAttribute('target')).toBe(null)
		expect(open?.getAttribute('variant')).toBe('solid')
		expect(docs?.getAttribute('target')).toBe('_blank')
		expect(docs?.getAttribute('rel')).toBe('noopener noreferrer')
		expect(docs?.getAttribute('variant')).toBe('outline')

		expect(section.querySelectorAll('[data-stub=UIcon]')).toHaveLength(3)
	})
})
