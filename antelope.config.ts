import { existsSync, readFileSync } from 'node:fs'
import { dmsConfig } from './providers/dms_config.js'

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null

const readManifest = (path: string) => {
  const url = new URL(path, import.meta.url)
  if (!existsSync(url)) return {}
  const manifest: unknown = JSON.parse(readFileSync(url, 'utf8'))
  return isObject(manifest) ? manifest : {}
}

const manifest = readManifest('./package.json')

const dependencies =
  'dependencies' in manifest && isObject(manifest.dependencies)
    ? Object.keys(manifest.dependencies)
    : []

const frontendModules = dependencies.filter(
  (name) => 'dmsFrontend' in readManifest(`./node_modules/${name}/package.json`)
)

/**
 * Read by `ajs dms build` and `ajs dms start` only: they bundle the dashboard frontend of each
 * module listed here. It lists every dependency that ships one (`dmsFrontend` in its
 * `package.json`), so a DMS module added with `pnpm add` reaches the dashboard after
 * `pnpm frontend:build`. `@antelopejs/dms` gets the options the runtime gets, read from `.env`.
 * The modules the application runs are in `providers/antelope_provider.ts`.
 */
export default {
  name: 'template-dms-adonis',
  modules: Object.fromEntries(
    frontendModules.map((name) => [
      name,
      {
        source: { type: 'local', path: `node_modules/${name}` },
        ...(name === '@antelopejs/dms' && {
          config: dmsConfig((variable) => process.env[variable]),
        }),
      },
    ])
  ),
}
