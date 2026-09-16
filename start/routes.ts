import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import type { AntelopeRuntime } from '@antelopejs/core'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

const DMS_PACKAGE = '@antelopejs-private/dms'

type DmsInterface = {
  getConfig(): {
    homepage?: string
    apiBaseUrl?: string
    clientBaseUrl?: string
    meta?: { title?: string; description?: string }
  }
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
  const dms = rt.use<DmsInterface>(DMS_PACKAGE)
  const config = dms.getConfig()

  return {
    servedBy: 'adonis',
    homepage: config.homepage,
    apiBaseUrl: config.apiBaseUrl,
    clientBaseUrl: config.clientBaseUrl,
    meta: config.meta,
  }
})
