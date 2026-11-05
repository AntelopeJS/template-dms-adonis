/** A run of the hero's headline, drawn highlighted or not. */
export interface HeadlineSegment {
	text: string
	isHighlighted: boolean
}

/**
 * Splits a headline into the runs it draws: the first occurrence of
 * `highlight` is highlighted. Without it, or when the headline does not hold
 * it, the headline is one plain run.
 */
export function splitHeadline(
	headline: string,
	highlight?: string,
): HeadlineSegment[] {
	const start = highlight ? headline.indexOf(highlight) : -1
	if (!highlight || start < 0) return [{ text: headline, isHighlighted: false }]
	const end = start + highlight.length
	return [
		{ text: headline.slice(0, start), isHighlighted: false },
		{ text: highlight, isHighlighted: true },
		{ text: headline.slice(end), isHighlighted: false },
	].filter((segment) => segment.text)
}
