import { antelopeKnipConfig } from '@antelopejs/tooling-configs/knip'

/**
 * AdonisJS loads the `bin/` entry points and the files `adonisrc.ts` lists through lazy imports;
 * `pino-pretty` is the logger's development target and `hot-hook` backs `node ace serve --hmr`.
 */
export default antelopeKnipConfig({
  entry: ['adonisrc.ts', 'bin/*.ts', 'config/*.ts', 'tests/bootstrap.ts', 'tests/**/*.spec.ts'],
  project: ['{app,bin,config,providers,start,tests}/**/*.ts'],
  ignoreDependencies: ['hot-hook', 'pino-pretty'],
})
