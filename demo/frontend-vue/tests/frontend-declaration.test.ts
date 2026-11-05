import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

// vitest runs with the frontend module as its root; the backend module sits one
// level above it.
const FRONTEND_DIR = process.cwd()
const PROJECT_DIR = join(FRONTEND_DIR, '..')

interface PackageJson {
	name: string
	dmsFrontend?: unknown
}

function readPackage(dir: string): PackageJson {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
}

// `ajs dms dev`, `build` and `start` take a module's frontend from the
// `frontendModule` its package.json declares as `dmsFrontend`; a package that
// ships frontend-vue/ without it is left out with a warning only, its
// components and translations missing from every page. tsc compiles src/ into
// dist/, so the declared dist file is checked through its source.
it('declares the frontend module the renderer reads, in package.json', async () => {
	const declaration = readPackage(PROJECT_DIR).dmsFrontend
	expect(declaration, 'package.json declares no dmsFrontend').toEqual(
		expect.stringMatching(/^dist\/.+\.js$/),
	)
	const source = join(
		PROJECT_DIR,
		String(declaration)
			.replace(/^dist\//, 'src/')
			.replace(/\.js$/, '.ts'),
	)
	expect(existsSync(source), `${source} does not exist`).toBe(true)

	const { frontendModule } = await import(source)
	expect(frontendModule).toBeTypeOf('function')
	expect(frontendModule({}, { dev: false })).toMatchObject({
		name: readPackage(FRONTEND_DIR).name,
		sourcePath: FRONTEND_DIR,
		renderer: { name: 'vue', version: '3' },
	})
})
