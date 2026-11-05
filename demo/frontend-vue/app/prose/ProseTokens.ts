import {
	defineComponent,
	h,
	resolveComponent,
	type PropType,
	type VNodeChild,
} from 'vue'
import { decodeHTML } from 'entities'
import type { Token, Tokens } from 'marked'
import ProseCallout from './ProseCallout.vue'
import {
	EXTERNAL_LINK_ATTRIBUTES,
	isSafeImageUrl,
	type ProseCalloutToken,
	type ProseHeadingToken,
	proseLinkKind,
} from './markdown'

// Draws the tokens `parseProse` read, element by element, with the theme's
// tokens: no HTML string is built, so nothing the Markdown says can inject
// markup. Raw HTML tokens are dropped (the text between inline tags stays),
// and a link or image whose address is refused is drawn as its text. A DMS
// route goes through `DmsLink`, fenced code through `DmsCodeSnippet`: both are
// public components of the DMS.

const HEADING_CLASSES: Record<ProseHeadingToken['level'], string> = {
	2: 'mt-10 mb-3 text-xl font-semibold tracking-tight sm:text-[1.375rem]',
	3: 'mt-8 mb-2 text-lg font-semibold tracking-tight',
	4: 'mt-6 mb-2 text-base font-semibold',
}

const CLASSES = {
	paragraph: 'my-4',
	heading: 'group text-highlighted scroll-mt-20 first:mt-0',
	anchor:
		'text-dimmed hover:text-primary ms-2 font-normal no-underline opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
	link: 'text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-2',
	strong: 'text-highlighted font-semibold',
	inlineCode:
		'border-default text-highlighted rounded-[5px] border bg-(--dms-bg-muted) px-1.5 py-px font-mono text-[0.875em]',
	unorderedList:
		'my-4 list-disc space-y-1.5 ps-6 marker:text-(--ui-text-dimmed)',
	orderedList:
		'my-4 list-decimal space-y-1.5 ps-6 marker:text-(--ui-text-dimmed)',
	taskList: 'my-4 list-none space-y-1.5 ps-0.5',
	listItem: 'ps-1 [&>p]:my-2',
	taskItem: 'flex items-start gap-2.5 [&>p]:my-0',
	checkbox: 'accent-primary mt-[0.45em] size-3.5 shrink-0',
	quote: 'border-accented text-muted my-5 border-s-2 ps-4',
	code: 'my-5',
	tableFrame: 'border-default my-5 overflow-x-auto rounded-[10px] border',
	table: 'w-full border-collapse text-sm [&_tr:last-child>td]:border-b-0',
	headerCell:
		'border-default text-highlighted border-b bg-(--dms-bg-muted) px-3 py-2 text-start font-semibold',
	cell: 'border-default border-b px-3 py-2 align-top',
	rule: 'border-default my-8',
	figure: 'my-6',
	image: 'border-default mx-auto h-auto max-w-full rounded-[10px] border',
	inlineImage: 'inline h-auto max-w-full align-middle',
	caption: 'text-muted mt-2 text-center text-sm',
} as const

type Translate = (key: string) => string

type Renderer = (token: Token, t: Translate) => VNodeChild

/** The tokens a token nests, for the kinds that nest any. */
function childTokens(token: Token): Token[] | undefined {
	return 'tokens' in token ? token.tokens : undefined
}

function renderInline(tokens: Token[] | undefined, t: Translate): VNodeChild[] {
	return (tokens ?? []).map((token) => renderInlineToken(token, t))
}

const INLINE_RENDERERS: Partial<Record<string, Renderer>> = {
	strong: (token, t) =>
		h('strong', { class: CLASSES.strong }, renderInline(childTokens(token), t)),
	em: (token, t) => h('em', renderInline(childTokens(token), t)),
	del: (token, t) =>
		h('del', { class: 'text-muted' }, renderInline(childTokens(token), t)),
	codespan: (token) =>
		h(
			'code',
			{ class: CLASSES.inlineCode },
			decodeHTML((token as Tokens.Codespan).text),
		),
	br: () => h('br'),
	link: (token, t) => renderLink(token as Tokens.Link, t),
	image: (token) => renderImage(token as Tokens.Image, CLASSES.inlineImage),
	html: () => null,
	checkbox: () => null,
}

function renderInlineToken(token: Token, t: Translate): VNodeChild {
	const render = INLINE_RENDERERS[token.type]
	if (render) return render(token, t)
	const children = childTokens(token)
	if (children?.length) return renderInline(children, t)
	return 'text' in token ? decodeHTML(String(token.text)) : null
}

function renderLink(token: Tokens.Link, t: Translate): VNodeChild {
	const children = renderInline(token.tokens, t)
	const kind = proseLinkKind(token.href)
	const title = token.title ? decodeHTML(token.title) : undefined
	if (!kind) return h('span', children)
	if (kind === 'internal')
		return h(
			resolveComponent('DmsLink'),
			{ to: token.href, class: CLASSES.link, title },
			() => children,
		)
	const attributes = kind === 'external' ? EXTERNAL_LINK_ATTRIBUTES : {}
	return h(
		'a',
		{ href: token.href, class: CLASSES.link, title, ...attributes },
		children,
	)
}

function renderImage(token: Tokens.Image, className: string): VNodeChild {
	const alt = decodeHTML(token.text)
	if (!isSafeImageUrl(token.href)) return alt
	return h('img', {
		src: token.href,
		alt,
		title: token.title ? decodeHTML(token.title) : undefined,
		loading: 'lazy',
		decoding: 'async',
		class: className,
	})
}

/** A paragraph holding one image and nothing else: drawn as a figure. */
function soleImage(token: Tokens.Paragraph): Tokens.Image | undefined {
	const parts = token.tokens.filter(
		(part) => !(part.type === 'text' && !part.raw.trim()),
	)
	return parts.length === 1 && parts[0]!.type === 'image'
		? (parts[0] as Tokens.Image)
		: undefined
}

function renderFigure(image: Tokens.Image): VNodeChild {
	const caption = image.title ? decodeHTML(image.title) : undefined
	return h('figure', { class: CLASSES.figure }, [
		renderImage(image, CLASSES.image),
		caption ? h('figcaption', { class: CLASSES.caption }, caption) : null,
	])
}

function renderHeading(token: ProseHeadingToken, t: Translate): VNodeChild {
	return h(
		`h${token.level}`,
		{ id: token.id, class: [CLASSES.heading, HEADING_CLASSES[token.level]] },
		[
			...renderInline(token.tokens, t),
			h(
				'a',
				{
					href: `#${token.id}`,
					class: CLASSES.anchor,
					'aria-label': t('demo.home.prose.anchor'),
				},
				'#',
			),
		],
	)
}

function renderList(token: Tokens.List, t: Translate): VNodeChild {
	const isTaskList = token.items.some((item) => item.task)
	const listClass = isTaskList
		? CLASSES.taskList
		: token.ordered
			? CLASSES.orderedList
			: CLASSES.unorderedList
	const start = token.ordered && token.start !== 1 ? token.start : undefined
	return h(
		token.ordered ? 'ol' : 'ul',
		{ class: listClass, start: start === '' ? undefined : start },
		token.items.map((item) => renderListItem(item, t)),
	)
}

function renderListItem(item: Tokens.ListItem, t: Translate): VNodeChild {
	const content = renderBlocks(item.tokens, t)
	if (!item.task) return h('li', { class: CLASSES.listItem }, content)
	return h('li', { class: CLASSES.taskItem }, [
		h('input', {
			type: 'checkbox',
			checked: item.checked,
			disabled: true,
			class: CLASSES.checkbox,
			'aria-label': t(
				item.checked
					? 'demo.home.prose.task_done'
					: 'demo.home.prose.task_todo',
			),
		}),
		h('div', { class: 'min-w-0' }, content),
	])
}

function renderQuote(token: Tokens.Blockquote, t: Translate): VNodeChild {
	const kind = (token as Partial<ProseCalloutToken>).callout
	if (!kind)
		return h(
			'blockquote',
			{ class: CLASSES.quote },
			renderBlocks(token.tokens, t),
		)
	return h(ProseCallout, { kind }, () => renderBlocks(token.tokens, t))
}

function renderTable(token: Tokens.Table, t: Translate): VNodeChild {
	const cell = (data: Tokens.TableCell, tag: 'th' | 'td') =>
		h(
			tag,
			{
				class: tag === 'th' ? CLASSES.headerCell : CLASSES.cell,
				style: data.align ? { textAlign: data.align } : undefined,
				scope: tag === 'th' ? 'col' : undefined,
			},
			renderInline(data.tokens, t),
		)
	return h('div', { class: CLASSES.tableFrame, tabindex: 0 }, [
		h('table', { class: CLASSES.table }, [
			h('thead', [
				h(
					'tr',
					token.header.map((data) => cell(data, 'th')),
				),
			]),
			h(
				'tbody',
				token.rows.map((row) =>
					h(
						'tr',
						row.map((data) => cell(data, 'td')),
					),
				),
			),
		]),
	])
}

const BLOCK_RENDERERS: Partial<Record<string, Renderer>> = {
	heading: (token, t) => renderHeading(token as ProseHeadingToken, t),
	paragraph: (token, t) => {
		const image = soleImage(token as Tokens.Paragraph)
		if (image && isSafeImageUrl(image.href)) return renderFigure(image)
		return h(
			'p',
			{ class: CLASSES.paragraph },
			renderInline(childTokens(token), t),
		)
	},
	list: (token, t) => renderList(token as Tokens.List, t),
	blockquote: (token, t) => renderQuote(token as Tokens.Blockquote, t),
	code: (token) => {
		const code = token as Tokens.Code
		return h('div', { class: CLASSES.code }, [
			h(resolveComponent('DmsCodeSnippet'), {
				code: code.text,
				language: code.lang?.split(/\s/)[0] || undefined,
			}),
		])
	},
	table: (token, t) => renderTable(token as Tokens.Table, t),
	hr: () => h('hr', { class: CLASSES.rule }),
	// A tight list item holds its text as a block-level `text` token.
	text: (token, t) =>
		childTokens(token)?.length
			? renderInline(childTokens(token), t)
			: decodeHTML((token as Tokens.Text).text),
	html: () => null,
	space: () => null,
	def: () => null,
	checkbox: () => null,
}

function renderBlocks(tokens: Token[] | undefined, t: Translate): VNodeChild[] {
	return (tokens ?? []).map((token) => {
		const render = BLOCK_RENDERERS[token.type]
		return render ? render(token, t) : renderInlineToken(token, t)
	})
}

/** Draws the tokens of a parsed Markdown text (`parseProse`). */
export default defineComponent({
	name: 'DemoProseTokens',
	props: {
		tokens: { type: Array as PropType<Token[]>, required: true },
	},
	setup(props) {
		const { t } = useI18n()
		return () => renderBlocks(props.tokens, t as Translate)
	},
})
