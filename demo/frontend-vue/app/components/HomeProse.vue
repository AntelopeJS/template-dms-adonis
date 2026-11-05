<script setup lang="ts">
import { computed } from 'vue'
import ProseTokens from '../prose/ProseTokens'
import { parseProse } from '../prose/markdown'

/** What a home section route answers (`GET /home/sections/:id`). */
interface ProseResponse {
	markdown?: string
}

// A long-form section of the home page (`CustomComponent("DemoHomeProse")` in
// src/home.ts): the GitHub-flavoured Markdown its route answers in the
// reader's language, drawn by ProseTokens as Vue nodes, on the server as in
// the browser, so the hydrated page keeps the server's layout.
interface HomeProseProps {
	/** Answers `{ markdown }`; the request names the reader's language. */
	fetchUrl: string
}

const props = defineProps<HomeProseProps>()

// The placeholder lines while the route answers.
const SKELETON_LINE_WIDTHS = ['w-1/3', 'w-full', 'w-11/12', 'w-4/5', 'w-2/3']

const { t, locale } = useI18n()

// `$authFetch` sends the reader's language in `x-content-language`; the
// locale in the query keeps one answer per language and reads the text again
// on a switch.
const { data, pending, error, refresh } = useApiData<ProseResponse>(
	() => props.fetchUrl,
	{ query: computed(() => ({ locale: locale.value })) },
)

const markdown = computed(() => data.value?.markdown ?? '')
const tokens = computed(() => parseProse(markdown.value))
const showSkeleton = computed(() => pending.value && !data.value)
// A failed first load shows a retry in place of the text; a failed refetch
// keeps the text on screen.
const hasError = computed(
	() => !pending.value && !data.value && Boolean(error.value),
)
</script>

<template>
	<DmsEmptyState
		v-if="hasError"
		variant="error"
		size="sm"
		:title="t('demo.home.prose.error')"
		:actions="[{ label: t('demo.home.prose.retry'), onClick: () => refresh() }]"
	/>
	<div
		v-else-if="showSkeleton"
		class="grid max-w-[72ch] gap-3"
		aria-busy="true"
	>
		<USkeleton
			v-for="lineWidth in SKELETON_LINE_WIDTHS"
			:key="lineWidth"
			class="h-3.5"
			:class="lineWidth"
		/>
	</div>
	<article
		v-else-if="markdown"
		class="text-default min-w-0 text-[15px] leading-7"
		data-demo-prose
	>
		<ProseTokens :tokens="tokens" />
	</article>
</template>
