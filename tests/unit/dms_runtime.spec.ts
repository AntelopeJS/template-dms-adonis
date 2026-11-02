import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

test.group('Embedded DMS runtime', () => {
  test('boots the DMS and answers through its interface', async ({ assert }) => {
    const runtime = await app.container.make(AntelopeRuntimeBinding)

    assert.isTrue(runtime.isRunning)
    const modules = await runtime.use('@antelopejs/interface-dms').GetFrontendModules()
    assert.isArray(modules)
  })
})
