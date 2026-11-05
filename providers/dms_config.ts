/**
 * The public options of `@antelopejs/dms`, shared by the runtime `antelope_provider.ts` starts and
 * the dashboard `pnpm frontend:build` bundles from `antelope.config.ts`, so both use the same
 * homepage and URLs. The provider adds the secrets, which the dashboard never needs.
 */
export function dmsOptions(
  variable: (name: 'DMS_API_BASE_URL' | 'DMS_CLIENT_BASE_URL') => string | undefined
) {
  return {
    homepage: '/modules',
    apiBaseUrl: variable('DMS_API_BASE_URL'),
    clientBaseUrl: variable('DMS_CLIENT_BASE_URL'),
    meta: {
      title: 'AntelopeJS DMS on AdonisJS',
      description: 'DMS running as a guest of an AdonisJS application',
    },
  }
}
