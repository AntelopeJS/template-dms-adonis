import { expect, it } from 'vitest'
import { frontendModule } from '../../src/frontend-module'
import demoPackage from '../../package.json'
import frontendPackage from '../package.json'

/**
 * `ajs dms dev`, `build` and `start` take a module's frontend from the
 * `frontendModule` its package.json declares as `dmsFrontend`; a package that
 * ships frontend-vue/ without it is left out with a warning only, its
 * components and translations missing from every page. tsc compiles src/ into
 * dist/, so the declared dist file is the one built from `src/frontend-module.ts`.
 */
it('declares the frontend module the renderer reads, in package.json', () => {
	expect(demoPackage.dmsFrontend).toBe('dist/frontend-module.js')
	expect(frontendModule()).toMatchObject({
		name: frontendPackage.name,
		sourcePath: process.cwd(),
		renderer: { name: 'vue', version: '3' },
	})
})
