import type { ApplicationService } from '@adonisjs/core/types'
import { createRuntime, type AntelopeRuntime } from '@antelopejs/core'
import env from '#start/env'

export const AntelopeRuntimeBinding = 'antelope.runtime'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    [AntelopeRuntimeBinding]: AntelopeRuntime
  }
}

export default class AntelopeProvider {
  private runtime?: AntelopeRuntime

  constructor(protected app: ApplicationService) {}

  register() {
    this.runtime = createRuntime({
      projectFolder: this.app.makePath(),
      modules: {
        '@antelopejs/dms': {
          config: {
            homepage: '/home',
            apiBaseUrl: env.get('DMS_API_BASE_URL'),
            clientBaseUrl: env.get('DMS_CLIENT_BASE_URL'),
            meta: {
              title: 'AntelopeJS DMS on AdonisJS',
              description: 'DMS running as a guest of an AdonisJS application',
            },
          },
        },
        '@antelopejs/dms-api': {},
        '@antelopejs/dms-media': {},
        '@antelopejs/dms-automation': {},
        '@antelopejs/dms-database': {},
        '@antelopejs/api': {
          config: {
            servers: [
              {
                protocol: 'http',
                host: env.get('DMS_API_HOST'),
                port: env.get('DMS_API_PORT'),
              },
            ],
            cors: {
              allowedOrigins: [env.get('DMS_CLIENT_BASE_URL')],
            },
          },
        },
        '@antelopejs/mongodb': {
          config: {
            url: env.get('MONGODB_URL'),
            database: env.get('MONGODB_DATABASE'),
          },
        },
        '@antelopejs/auth-jwt': {
          config: { secret: env.get('DMS_JWT_SECRET') },
        },
        '@antelopejs/file-storage-local': {
          config: {
            storagePath: '.antelope/file-storage',
            baseUrl: env.get('DMS_API_BASE_URL'),
            defaultVisibility: 'private',
          },
        },
        '@antelopejs/nodemailer': {
          config: { ethereal: true },
        },
      },
      uses: ['@antelopejs/interface-dms'],
    })

    this.app.container.bindValue(AntelopeRuntimeBinding, this.runtime)
  }

  async start() {
    await this.runtime?.start()
  }

  async shutdown() {
    await this.runtime?.stop()
  }
}
