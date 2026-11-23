/** Returns `value` once it is neither `null` nor `undefined`, and fails the test otherwise. */
export function required<T>(value: T | null | undefined, what: string): T {
	if (value === null || value === undefined) {
		throw new Error(`Expected ${what} to exist`)
	}
	return value
}
