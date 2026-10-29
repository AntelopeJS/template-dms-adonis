import { Env } from '@adonisjs/core/env'

/**
 * The validated environment. `Env.create` checks every variable below when the application
 * boots and casts each value to its JavaScript type.
 */
export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  MONGODB_URL: Env.schema.string(),
  MONGODB_DATABASE: Env.schema.string(),

  DMS_API_HOST: Env.schema.string(),
  DMS_API_PORT: Env.schema.number(),
  /**
   * The origin browsers reach the DMS API at. `@antelopejs/api` requires it as `publicBaseUrl`
   * outside development, and the embedded runtime never runs in development.
   */
  DMS_API_BASE_URL: Env.schema.string(),
  DMS_CLIENT_BASE_URL: Env.schema.string(),
  DMS_JWT_SECRET: Env.schema.string(),
  /**
   * The dashboard bootstrap credential. The embedded runtime never runs in development, so the DMS
   * publishes no per-boot credential for `ajs dms dev`: the DMS and the dashboard both read this one.
   */
  DMS_BOOTSTRAP_SECRET: Env.schema.string(),
})
