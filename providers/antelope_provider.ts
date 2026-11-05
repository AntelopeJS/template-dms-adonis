import type { ApplicationService } from '@adonisjs/core/types'
import { createRuntime, type AntelopeRuntime } from '@antelopejs/core'
import env from '#start/env'
import { publicModuleOptions } from '#providers/public_module_options'

export const AntelopeRuntimeBinding = 'antelope.runtime'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    [AntelopeRuntimeBinding]: AntelopeRuntime
  }
}

declare module '@antelopejs/core' {
  interface EmbeddedInterfaces {
    '@antelopejs/interface-dms': {
      GetFrontendModules(): Promise<{ name: string; options?: { homepage?: string } }[]>
    }
    '@antelopejs/interface-dms/client-base-url': {
      GetClientBaseUrl(): Promise<string | undefined>
    }
  }
}

export default class AntelopeProvider {
  private runtime?: AntelopeRuntime

  constructor(protected app: ApplicationService) {}

  register() {
    const publicOptions = publicModuleOptions((name) => env.get(name))
    this.runtime = createRuntime({
      projectFolder: this.app.makePath(),
      modules: {
        '@antelopejs/dms': {
          config: {
            ...publicOptions['@antelopejs/dms'],
            auth: { jwtSecret: env.get('DMS_JWT_SECRET') },
            htmlRender: { serviceSecret: env.get('DMS_HTML_RENDER_SECRET') },
            frontend: { bootstrapSecret: env.get('DMS_BOOTSTRAP_SECRET') },
          },
        },
        '@antelopejs/dms-api': {},
        '@antelopejs/dms-database': {},
        '@antelopejs/dms-automation': {},
        '@antelopejs/dms-saas': {
          config: {
            stripe: {
              ...publicOptions['@antelopejs/dms-saas'].stripe,
              secretKey: env.get('STRIPE_SECRET_KEY'),
              webhookSecret: env.get('STRIPE_WEBHOOK_SECRET'),
            },
          },
        },
        '@antelopejs/dms-lang': { config: { editable: true } },
        '@antelopejs/dms-media': {},
        '@antelopejs/dms-marketing': { config: publicOptions['@antelopejs/dms-marketing'] },
        '@antelopejs/dms-mailing': {},
        'template-dms-demo': { path: this.app.makePath('demo') },
        '@antelopejs/api': {
          config: {
            publicBaseUrl: env.get('DMS_API_BASE_URL'),
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
            ...(this.app.inTest && { options: { serverSelectionTimeoutMS: 2000 } }),
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
            stagingExpiration: 24 * 60 * 60,
          },
        },
        '@antelopejs/nodemailer': {
          config: { ethereal: true },
        },
      },
      uses: ['@antelopejs/interface-dms'],
      logging: { channelFilter: { '*': 'warn' } },
    })

    this.app.container.bindValue(AntelopeRuntimeBinding, this.runtime)
  }

  async start() {
    try {
      await this.runtime?.start()
    } catch (error) {
      const mongoUnreachable =
        error instanceof AggregateError &&
        error.errors.some(
          (cause) => cause instanceof Error && cause.name === 'MongoServerSelectionError'
        )
      if (mongoUnreachable) {
        throw new Error(
          `MongoDB is unreachable at ${env.get('MONGODB_URL')}. Start it with \`docker compose -f .github/compose.yml up -d --wait\`.`,
          { cause: error }
        )
      }
      throw error
    }
  }

  async shutdown() {
    await this.runtime?.stop()
  }
}
