import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

type DmsFrontendModules = {
  GetFrontendModules(): Promise<{ name: string; options?: { homepage?: string } }[]>
}

test.group('DMS homepage', () => {
  test('is a page the DMS serves', async ({ assert }) => {
    const runtime = await app.container.make(AntelopeRuntimeBinding)
    const modules = await runtime
      .use<DmsFrontendModules>('@antelopejs/interface-dms')
      .GetFrontendModules()
    const homepage = modules.find((module) => module.options?.homepage)?.options?.homepage
    assert.isString(homepage)

    const url = new URL('/dms/page', env.get('DMS_API_BASE_URL'))
    url.searchParams.set('path', homepage!)
    const response = await fetch(url)
    assert.notEqual(
      response.status,
      404,
      `${homepage}, where the dashboard sends visitors after sign-in and from /, is not a DMS page`
    )
  })
})
