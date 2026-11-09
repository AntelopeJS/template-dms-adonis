import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'

const DRIVER_DEFAULT_SELECTION_MS = 30_000
const SELECTION_ERROR = 'MongoServerSelectionError'

test.group('MongoDB unreachable', () => {
  test('a development server gives up well before the driver default', async ({ assert }) => {
    const startedAt = performance.now()
    const server = spawn(process.execPath, ['--import', '@poppinss/ts-exec', 'bin/server.ts'], {
      cwd: app.makePath(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        MONGODB_URL: 'mongodb://127.0.0.1:1',
        PORT: '0',
        DMS_API_PORT: '0',
      },
    })
    try {
      const elapsedMs = await new Promise<number>((resolve, reject) => {
        let output = ''
        const collect = (chunk: Buffer) => {
          output += chunk.toString()
          if (output.includes(SELECTION_ERROR)) resolve(performance.now() - startedAt)
        }
        server.stdout.on('data', collect)
        server.stderr.on('data', collect)
        server.on('error', reject)
        server.on('close', () => reject(new Error(`exited without ${SELECTION_ERROR}:\n${output}`)))
      })

      assert.isBelow(elapsedMs, DRIVER_DEFAULT_SELECTION_MS * 0.8)
    } finally {
      server.kill()
    }
  }).timeout(DRIVER_DEFAULT_SELECTION_MS * 2)
})
