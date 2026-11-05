import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /**
   * Ace commands registered from packages. The application's own commands are scanned from the
   * `./commands` directory.
   */
  commands: [() => import('@adonisjs/core/commands')],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('#providers/antelope_provider'),
  ],

  preloads: [() => import('#start/routes'), () => import('#start/kernel')],

  /**
   * The demo module the runtime loads from `demo/`, copied into the production build: its manifest,
   * its compiled code, the Markdown it reads and the catalogs dms-lang edits.
   */
  metaFiles: [
    { pattern: 'demo/package.json', reloadServer: false },
    { pattern: 'demo/dist/**/*.js', reloadServer: false },
    { pattern: 'demo/content/**', reloadServer: false },
    { pattern: 'demo/frontend-vue/i18n/**', reloadServer: false },
  ],

  tests: {
    /** The test suites `node ace test` runs. Add or remove suites as the application needs. */
    suites: [
      {
        files: ['tests/unit/**/*.spec.{ts,js}'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: true,
  },
})
