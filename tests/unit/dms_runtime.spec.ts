import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

type DmsPages = {
  GetFrontendModules(): Promise<{ name: string }[]>
}

test.group('Embedded DMS runtime', () => {
  test('boots the DMS and answers through its interface', async ({ assert }) => {
    const runtime = await app.container.make(AntelopeRuntimeBinding)

    assert.isTrue(runtime.isRunning)
    const modules = await runtime.use<DmsPages>('@antelopejs/interface-dms').GetFrontendModules()
    assert.isArray(modules)
  })
})
