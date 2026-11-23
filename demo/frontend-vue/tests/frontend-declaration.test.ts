import { expect, it } from 'vitest'
import { frontendModule } from '../../src/frontend-module'
import demoPackage from '../../package.json'
import frontendPackage from '../package.json'

it('declares the frontend module the renderer reads, in package.json', () => {
	expect(demoPackage.dmsFrontend).toBe('dist/frontend-module.js')
	expect(frontendModule()).toMatchObject({
		name: frontendPackage.name,
		sourcePath: process.cwd(),
		renderer: { name: 'vue', version: '3' },
	})
})
