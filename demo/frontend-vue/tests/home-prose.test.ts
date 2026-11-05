/**
 * A home section draws the Markdown its route answers as elements of its own,
 * never an HTML string, so raw HTML and script addresses never reach the
 * page; asks again in the reader's language; and draws the same on the server
 * as in the browser, so hydration changes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type App, computed, createApp, createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import HomeProse from '../app/components/HomeProse.vue'

const data = ref<{ markdown?: string } | null>(null)
const error = ref<unknown>(null)
const pending = ref(false)
const locale = ref('en-GB')
const apiData = vi.fn()

const STUBS = ['UIcon', 'USkeleton', 'DmsEmptyState']

function install(app: App): App {
	for (const name of STUBS)
		app.component(name, (_, { attrs }) =>
			h('i', { ...attrs, 'data-stub': name }),
		)
	app.component('DmsLink', {
		props: ['to'],
		setup:
			(props: { to: string }, { slots }) =>
			() =>
				h('a', { href: props.to, 'data-dms-link': '' }, slots.default?.()),
	})
	app.component('DmsCodeSnippet', {
		props: ['code', 'language'],
		setup: (props: { code: string }) => () => h('pre', props.code),
	})
	return app
}

let app: App | undefined
let host: HTMLDivElement

const flush = () => new Promise((resolve) => setTimeout(resolve))

async function mount(markdown: string | null) {
	data.value = markdown === null ? null : { markdown }
	app = install(
		createApp({
			setup: () => () =>
				h(HomeProse, { fetchUrl: '/dms/pages/home/sections/why' }),
		}),
	)
	app.mount(host)
	await flush()
}

beforeEach(() => {
	data.value = null
	error.value = null
	pending.value = false
	locale.value = 'en-GB'
	apiData.mockClear()
	vi.stubGlobal('useI18n', () => ({ locale, t: (key: string) => key }))
	vi.stubGlobal('useApiData', (url: () => string, options: unknown) => {
		apiData(url, options)
		return { data, pending, error, refresh: async () => {} }
	})
	host = document.createElement('div')
	document.body.append(host)
})

afterEach(() => {
	app?.unmount()
	app = undefined
	host.remove()
	vi.unstubAllGlobals()
})

const GUIDE = `# Welcome

Read the **guide**, then *start*.

## Install

- [x] Create the workspace
- [ ] Invite the team

1. One
2. Two

> [!TIP]
> Import a CSV first.

> A plain quote.

| Plan | Seats |
|:-----|------:|
| Pro  | 10    |

\`\`\`json
{ "id": 1 }
\`\`\`

---

![Dashboard](/images/dashboard.png "The dashboard")

[Orders](/orders/orders-list), [site](https://example.com), [mail](mailto:ada@example.com), [phone](tel:+3212345678), [top](#welcome) and \`inline\`.
`

describe('HomeProse', () => {
	it('draws every Markdown element with its own element', async () => {
		await mount(GUIDE)

		const article = host.querySelector('article')!
		expect(article.querySelector('h2#welcome')?.textContent).toContain(
			'Welcome',
		)
		expect(article.querySelector("h2#install a[href='#install']")).not.toBe(
			null,
		)
		expect(article.querySelector('strong')?.textContent).toBe('guide')
		expect(article.querySelector('em')?.textContent).toBe('start')
		const boxes = article.querySelectorAll<HTMLInputElement>(
			'input[type=checkbox]',
		)
		expect([...boxes].map((box) => [box.checked, box.disabled])).toEqual([
			[true, true],
			[false, true],
		])
		expect(article.querySelectorAll('ol > li')).toHaveLength(2)
		const tip = article.querySelector('[data-callout=tip]')
		expect(tip?.textContent).toContain('demo.home.prose.callout.tip')
		expect(tip?.textContent).toContain('Import a CSV first.')
		expect(tip?.querySelector('[data-stub=UIcon]')?.getAttribute('name')).toBe(
			'i-ph-lightbulb',
		)
		expect(article.querySelector('blockquote')?.textContent).toContain(
			'A plain quote.',
		)
		expect(article.querySelector('th')?.style.textAlign).toBe('left')
		expect(article.querySelectorAll('td')[1]?.style.textAlign).toBe('right')
		expect(article.querySelector('pre')?.textContent).toBe('{ "id": 1 }')
		expect(article.querySelector('hr')).not.toBe(null)
		expect(article.querySelector('figure img')?.getAttribute('src')).toBe(
			'/images/dashboard.png',
		)
		expect(article.querySelector('figcaption')?.textContent).toBe(
			'The dashboard',
		)
		expect(article.querySelector('p code')?.textContent).toBe('inline')
	})

	it('routes a dashboard link in place and opens another site in a new tab', async () => {
		await mount(GUIDE)

		const link = (text: string) =>
			[...host.querySelectorAll('a')].find((a) => a.textContent === text)!
		expect(link('Orders').hasAttribute('data-dms-link')).toBe(true)
		expect(link('site').getAttribute('target')).toBe('_blank')
		expect(link('site').getAttribute('rel')).toBe('noopener noreferrer')
		expect(link('mail').getAttribute('href')).toBe('mailto:ada@example.com')
		expect(link('mail').getAttribute('target')).toBe(null)
		expect(link('phone').getAttribute('href')).toBe('tel:+3212345678')
		expect(link('top').getAttribute('href')).toBe('#welcome')
	})

	it('never draws raw HTML nor a script address', async () => {
		await mount(
			[
				'<script>alert(1)</script>',
				'',
				'Hi <img src=x onerror="alert(1)"> <b>bold</b>',
				'',
				'[click](javascript:alert(1)) [data](data:text/html,x) [vb](vbscript:msgbox)',
				'',
				'![pixel](javascript:alert(1))',
			].join('\n'),
		)

		const article = host.querySelector('article')!
		expect(article.querySelector('script, b, img')).toBe(null)
		expect(article.querySelectorAll('a')).toHaveLength(0)
		expect(article.innerHTML).not.toContain('javascript:')
		expect(article.innerHTML).not.toContain('onerror')
		expect(article.textContent).toContain('click')
		expect(article.textContent).toContain('bold')
		expect(article.textContent).toContain('pixel')
	})

	it("reads its route again in the reader's language", async () => {
		await mount('Text')

		const [url, options] = apiData.mock.calls[0]! as [
			() => string,
			{ query: ReturnType<typeof computed> },
		]
		expect(url()).toBe('/dms/pages/home/sections/why')
		expect(options.query.value).toEqual({ locale: 'en-GB' })
		locale.value = 'fr-FR'
		expect(options.query.value).toEqual({ locale: 'fr-FR' })
	})

	it('shows placeholder lines while the route answers', async () => {
		pending.value = true
		await mount(null)

		expect(host.querySelector('[aria-busy=true]')).not.toBe(null)
		expect(host.querySelector('article')).toBe(null)
	})

	it('offers a retry when the first load fails', async () => {
		error.value = new Error('offline')
		await mount(null)

		expect(host.querySelector('[data-stub=DmsEmptyState]')).not.toBe(null)
	})

	it("hydrates over the server's render without a change", async () => {
		data.value = { markdown: GUIDE }
		const root = () =>
			h(HomeProse, { fetchUrl: '/dms/pages/home/sections/why' })
		host.innerHTML = await renderToString(
			install(createSSRApp({ setup: () => root })),
		)
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

		app = install(createSSRApp({ setup: () => root }))
		app.mount(host)
		await flush()

		const mismatches = [...warn.mock.calls, ...errorLog.mock.calls].filter(
			(call) => String(call[0]).includes('Hydration'),
		)
		warn.mockRestore()
		errorLog.mockRestore()
		expect(mismatches).toEqual([])
		expect(host.querySelector('h2#install')).not.toBe(null)
	})
})
