import { pageRoutePath } from "@antelopejs/interface-dms/page";

/** Full slug of the Settings page (helio root category, then the page id). */
export const SETTINGS_SLUG = "/helio/settings";

/** The route the page class declares to read the settings values, as the browser calls it. */
export const SETTINGS_VALUES_URL = pageRoutePath(SETTINGS_SLUG, "/values");
/** The route that rotates the API key, as the browser calls it. */
export const SETTINGS_ROTATE_URL = pageRoutePath(
  SETTINGS_SLUG,
  "/api-key/rotate",
);
/** The danger-zone route, as the browser calls it. */
export const SETTINGS_DANGER_URL = pageRoutePath(SETTINGS_SLUG, "/danger-zone");
/** The route that resets the settings to their defaults, as the browser calls it. */
export const SETTINGS_RESET_URL = pageRoutePath(SETTINGS_SLUG, "/reset");
