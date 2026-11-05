<script setup lang="ts">
import { computed, useId } from 'vue'
import { splitHeadline } from '../utils/heroHeadline'

/** A link button of the hero: a DMS route, an `#anchor` or a web address. */
interface HeroAction {
	label: string
	to: string
	icon?: string
	variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
}

// The opening of the home page (`CustomComponent("DemoHomeHero")` in
// src/home.ts): an eyebrow, a display-size headline with its highlighted
// words, a lead, link buttons, and a composition of icons beside the texts
// from the `lg` breakpoint (under them on a phone), on a soft wash of the
// theme's primary colour. Texts follow the `$` i18n convention.
interface HomeHeroProps {
	eyebrow?: string
	title?: string
	/** Words of the headline drawn in the primary colour (first occurrence). */
	highlight?: string
	lead?: string
	/** Up to three: the first leads, the others are neutral. */
	actions?: HeroAction[]
	/** Up to three icons. */
	icons?: string[]
}

const props = withDefaults(defineProps<HomeHeroProps>(), {
	eyebrow: undefined,
	title: undefined,
	highlight: undefined,
	lead: undefined,
	actions: () => [],
	icons: () => [],
})

const MAX_ACTIONS = 3
const MAX_ICONS = 3

const EXTERNAL_LINK = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i
const EXTERNAL_LINK_ATTRIBUTES = {
	target: '_blank',
	rel: 'noopener noreferrer',
} as const

// The icon composition: the middle tile leads, the others lean behind it.
const ICON_TILES = [
	'bg-primary/10 ring-primary/25 text-primary size-20 -rotate-6 sm:size-24',
	'bg-(--dms-surface-card) ring-default text-highlighted z-10 size-24 shadow-md sm:size-28',
	'bg-(--dms-accent-tint) ring-primary/20 text-primary size-20 rotate-6 sm:size-24',
]
const ICON_GLYPHS = [
	'size-9 sm:size-10',
	'size-11 sm:size-12',
	'size-9 sm:size-10',
]

const { processI18n } = useTranslation()
const titleId = useId()

const text = (value: string | undefined) => (value ? processI18n(value) : '')

const headline = computed(() =>
	splitHeadline(text(props.title), text(props.highlight) || undefined),
)
const actions = computed(() => props.actions.slice(0, MAX_ACTIONS))
const icons = computed(() => props.icons.slice(0, MAX_ICONS))

// An absolute address opens in a new tab; a route or an anchor in place.
function linkProps(to: string): Record<string, string> {
	return EXTERNAL_LINK.test(to) ? { to, ...EXTERNAL_LINK_ATTRIBUTES } : { to }
}
</script>

<template>
	<section
		class="border-primary/15 from-primary/12 via-primary/4 rounded-(--dms-radius-card) border bg-linear-135 to-transparent px-5 py-8 sm:px-10 sm:py-14"
		:aria-labelledby="props.title ? titleId : undefined"
		data-demo-hero
	>
		<div
			class="grid gap-10"
			:class="
				icons.length
					? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center'
					: ''
			"
		>
			<div class="flex max-w-3xl min-w-0 flex-col items-start">
				<p
					v-if="props.eyebrow"
					class="text-primary mb-3 text-xs font-semibold tracking-[0.14em] uppercase"
				>
					{{ text(props.eyebrow) }}
				</p>
				<h2
					v-if="props.title"
					:id="titleId"
					class="text-highlighted text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
				>
					<template v-for="(segment, index) in headline" :key="index">
						<span v-if="segment.isHighlighted" class="text-primary">
							{{ segment.text }}
						</span>
						<template v-else>{{ segment.text }}</template>
					</template>
				</h2>
				<p
					v-if="props.lead"
					class="text-muted mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty sm:text-xl"
				>
					{{ text(props.lead) }}
				</p>
				<div v-if="actions.length" class="mt-7 flex flex-wrap gap-2.5">
					<UButton
						v-for="(action, index) in actions"
						:key="`${index}-${action.label}`"
						:label="text(action.label)"
						:icon="action.icon"
						size="lg"
						:variant="action.variant ?? (index === 0 ? 'solid' : 'outline')"
						:color="index === 0 ? 'primary' : 'neutral'"
						v-bind="linkProps(action.to)"
					/>
				</div>
			</div>

			<div v-if="icons.length" class="min-w-0" data-demo-hero-media>
				<div class="flex items-center justify-center py-4" aria-hidden="true">
					<div
						v-for="(icon, index) in icons"
						:key="`${index}-${icon}`"
						class="-mx-2 grid shrink-0 place-items-center rounded-3xl ring-1 ring-inset"
						:class="ICON_TILES[icons.length === 1 ? 1 : index]"
					>
						<UIcon
							:name="icon"
							:class="ICON_GLYPHS[icons.length === 1 ? 1 : index]"
						/>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
