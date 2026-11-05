/** The `.env` variables the `@antelopejs/dms` module reads. */
type DmsVariable =
  | 'DMS_API_BASE_URL'
  | 'DMS_CLIENT_BASE_URL'
  | 'DMS_JWT_SECRET'
  | 'DMS_HTML_RENDER_SECRET'
  | 'DMS_BOOTSTRAP_SECRET'

/**
 * The options of `@antelopejs/dms`, shared by the runtime `antelope_provider.ts` starts and the
 * dashboard `pnpm frontend:build` bundles from `antelope.config.ts`, so both use the same homepage
 * and URLs.
 */
export function dmsConfig(variable: (name: DmsVariable) => string | undefined) {
  return {
    homepage: '/modules',
    apiBaseUrl: variable('DMS_API_BASE_URL'),
    clientBaseUrl: variable('DMS_CLIENT_BASE_URL'),
    auth: { jwtSecret: variable('DMS_JWT_SECRET') },
    htmlRender: { serviceSecret: variable('DMS_HTML_RENDER_SECRET') },
    frontend: { bootstrapSecret: variable('DMS_BOOTSTRAP_SECRET') },
    meta: {
      title: 'AntelopeJS DMS on AdonisJS',
      description: 'DMS running as a guest of an AdonisJS application',
    },
  }
}
