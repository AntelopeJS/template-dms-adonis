import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import type { AntelopeRuntime } from '@antelopejs/core'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

const DMS_INTERFACE = '@antelopejs/interface-dms'
const DMS_CLIENT_BASE_URL_INTERFACE = '@antelopejs/interface-dms/client-base-url'

type DmsClientBaseUrl = {
  GetClientBaseUrl(): Promise<string | undefined>
}

type DmsPages = {
  GetFrontendModules(): Promise<{ name: string }[]>
}

async function runtime(): Promise<AntelopeRuntime> {
  return app.container.make(AntelopeRuntimeBinding)
}

router.get('/', async () => {
  const rt = await runtime()
  return {
    host: 'adonisjs',
    dms: { running: rt.isRunning, modules: rt.manager.listModules() },
  }
})

router.get('/dms/info', async () => {
  const rt = await runtime()
  const clientBaseUrl = await rt
    .use<DmsClientBaseUrl>(DMS_CLIENT_BASE_URL_INTERFACE)
    .GetClientBaseUrl()
  const frontendModules = await rt.use<DmsPages>(DMS_INTERFACE).GetFrontendModules()

  return {
    servedBy: 'adonis',
    clientBaseUrl,
    frontendModules: frontendModules.map((module) => module.name),
  }
})
