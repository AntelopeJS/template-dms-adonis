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
        '@antelopejs-private/cms': {
          config: {
            homepage: '/home',
            apiBaseUrl: env.get('ANTELOPE_API_BASE_URL'),
            clientBaseUrl: env.get('ANTELOPE_CLIENT_BASE_URL'),
            meta: {
              title: 'AntelopeJS CMS on AdonisJS',
              description: 'CMS running as a guest of an AdonisJS application',
            },
          },
        },
        '@antelopejs/api': {
          config: {
            servers: [
              {
                protocol: 'http',
                host: env.get('ANTELOPE_API_HOST'),
                port: env.get('ANTELOPE_API_PORT'),
              },
            ],
            cors: {
              allowedOrigins: [env.get('ANTELOPE_CLIENT_BASE_URL')],
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
          config: { secret: env.get('ANTELOPE_JWT_SECRET') },
        },
        '@antelopejs/file-storage-local': {
          config: {
            storagePath: '.antelope/file-storage',
            baseUrl: env.get('ANTELOPE_API_BASE_URL'),
            defaultVisibility: 'private',
          },
        },
        '@antelopejs/nodemailer': {
          config: { ethereal: true },
        },
      },
      uses: ['@antelopejs-private/cms'],
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
