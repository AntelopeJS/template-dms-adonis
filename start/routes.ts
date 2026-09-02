import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import type { AntelopeRuntime } from '@antelopejs/core'
import { AntelopeRuntimeBinding } from '#providers/antelope_provider'

const CMS_PACKAGE = '@antelopejs-private/cms'

type CmsInterface = {
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
    cms: { running: rt.isRunning, modules: rt.manager.listModules() },
  }
})

router.get('/cms/info', async () => {
  const rt = await runtime()
  const cms = rt.use<CmsInterface>(CMS_PACKAGE)
  const config = cms.getConfig()

  return {
    servedBy: 'adonis',
    homepage: config.homepage,
    apiBaseUrl: config.apiBaseUrl,
    clientBaseUrl: config.clientBaseUrl,
    meta: config.meta,
  }
})
