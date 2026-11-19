import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  commandEnv,
  copyProject,
  freePort,
  killGroup,
  mustRun,
  sleep,
  withMongo,
  withServer,
  writeEnv,
} from './stack.ts'

await test('build-output', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await mustRun('pnpm', ['build'], { cwd: project.dir })
  for (const file of [
    'build/bin/server.js',
    'build/ace.js',
    'build/package.json',
    'build/providers/antelope_provider.js',
    'build/start/routes.js',
  ]) {
    assert.ok(existsSync(join(project.dir, file)), `${file} exists`)
  }
})

await test('dashboard', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const token = 'template-test-dashboard-setup-token'
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo, { DMS_SETUP_TOKEN: token })
    await withServer(project.dir, ports, async () => {
      await mustRun('pnpm', ['frontend:build'], { cwd: project.dir, timeoutMs: 900_000 })
      const port = await freePort()
      const dashboard = spawn('pnpm', ['frontend:start', '-p', String(port)], {
        cwd: project.dir,
        env: commandEnv(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let log = ''
      dashboard.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()))
      dashboard.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()))
      try {
        const wizard = `http://localhost:${port}/onboarding?token=${token}`
        let status = 0
        let body = ''
        for (let attempt = 0; attempt < 60 && status !== 200; attempt += 1) {
          const response = await fetch(wizard).catch(() => null)
          status = response?.status ?? 0
          body = (await response?.text()) ?? ''
          if (status !== 200) await sleep(1000)
        }
        assert.equal(status, 200, `the wizard answers:\n${log.slice(-4000)}`)
        assert.match(body, /<title>Set up your platform/, "the wizard's title is translated")
        assert.match(body, /Welcome to Antelope DMS/, 'the wizard renders its first step')
        assert.match(body, /"homepage":"\/home"/, "the dashboard carries the provider's homepage")
        assert.match(
          body,
          new RegExp(`"baseURL":"http://localhost:${ports.api}"`),
          'the dashboard calls the DMS API at DMS_API_BASE_URL of .env'
        )
      } finally {
        killGroup(dashboard)
      }
    })
  })
})
