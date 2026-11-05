/** The variables of `.env` the public options read. */
type PublicVariable = 'DMS_API_BASE_URL' | 'DMS_CLIENT_BASE_URL' | 'STRIPE_PUBLISHABLE_KEY'

/**
 * The public options of the modules whose dashboard frontend reads its config, shared by the
 * runtime `antelope_provider.ts` starts and the dashboard `pnpm frontend:build` bundles from
 * `antelope.config.ts`, so both use the same homepage, URLs and keys. The provider adds the
 * secrets, which the dashboard never needs.
 */
export function publicModuleOptions(variable: (name: PublicVariable) => string | undefined) {
  return {
    '@antelopejs/dms': {
      homepage: '/home',
      apiBaseUrl: variable('DMS_API_BASE_URL'),
      clientBaseUrl: variable('DMS_CLIENT_BASE_URL'),
      meta: {
        title: 'AntelopeJS DMS on AdonisJS',
        description: 'DMS running as a guest of an AdonisJS application',
      },
    },
    '@antelopejs/dms-saas': {
      stripe: { publishableKey: variable('STRIPE_PUBLISHABLE_KEY') },
    },
    '@antelopejs/dms-marketing': {
      dashboardTracking: { enabled: true, snapshots: true },
      heatmapSampleRate: 1,
    },
  }
}
