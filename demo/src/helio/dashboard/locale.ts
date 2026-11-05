/**
 * The languages chart labels are written in on the server. The DMS runs
 * series names through its `$` translation, but not the slice labels of a
 * circular chart nor the categories of an axis, so those are formatted here
 * from the language stored on the reader's profile.
 */
export type ReaderLanguage = "fr" | "en";

/** Maps a profile language to a supported one, English when it is absent or not French. */
export function readerLanguage(language: string | undefined): ReaderLanguage {
  return language?.startsWith("fr") ? "fr" : "en";
}

const LOCALES: Record<ReaderLanguage, string> = { fr: "fr-BE", en: "en-GB" };

/** "May 26" / "mai 26" for the month starting at `time`. */
export function monthLabel(time: number, language: ReaderLanguage): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    month: "short",
    year: "2-digit",
  }).format(time);
}

/** 4 January 2026 is a Sunday: day 0 of the week, as Date.getDay() counts. */
const A_SUNDAY = new Date(2026, 0, 4);

/** "Mon" / "lun." for a Date.getDay() index. */
export function weekdayLabel(day: number, language: ReaderLanguage): string {
  const date = new Date(A_SUNDAY);
  date.setDate(A_SUNDAY.getDate() + day);
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: "short",
  }).format(date);
}
