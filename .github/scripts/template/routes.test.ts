import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  collections,
  copyProject,
  DEFAULT_DATABASE,
  DEV_SERVER,
  DEMO_FRONTEND_MODULE,
  EXPECTED_MODULES,
  getJson,
  isRecord,
  isStringArray,
  serve,
  withMongo,
  withServer,
  writeEnv,
} from './stack.ts'

await test('serve-structure', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo)
    const server = await serve(project.dir, ports)
    try {
      const home = await getJson(`${server.url}/`)
      assert.equal(home.status, 200)
      assert.ok(isRecord(home.json))
      assert.equal(home.json.host, 'adonisjs')
      const dms = home.json.dms
      assert.ok(isRecord(dms))
      assert.equal(dms.running, true)
      const modules = dms.modules
      assert.ok(isStringArray(modules), '/ lists the module names')
      assert.deepEqual(
        EXPECTED_MODULES.filter((name) => !modules.includes(name)),
        [],
        'every module of the provider is loaded'
      )

      const info = await getJson(`${server.url}/dms/info`)
      assert.ok(isRecord(info.json))
      assert.equal(info.json.servedBy, 'adonis')
      assert.equal(info.json.clientBaseUrl, 'http://localhost:3001')
      const frontends = info.json.frontendModules
      assert.ok(isStringArray(frontends), '/dms/info lists the frontend module names')
      assert.ok(
        frontends.includes('@antelopejs/dms-frontend-vue'),
        'the dashboard module is listed'
      )
      assert.deepEqual(
        frontends.filter(
          (name) => !name.startsWith('@antelopejs/') && name !== DEMO_FRONTEND_MODULE
        ),
        [],
        'only module names are listed'
      )

      const names = await collections(mongo, DEFAULT_DATABASE)
      assert.ok(names.includes('dms-core__users'), 'the DMS users collection exists')
      assert.ok(names.includes('__antelope_instances'), 'the runtime registered its instance')
    } finally {
      assert.equal(await server.stop(), true, 'SIGINT ended the server')
    }
  })
})

await test('not-found', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo)
    await withServer(project.dir, ports, async (server) => {
      const missing = await fetch(`${server.url}/nope`)
      assert.equal(missing.status, 404, 'unknown route')
      const wrong = await fetch(`${server.url}/dms/info`, { method: 'POST', body: '{}' })
      assert.equal(wrong.status, 404, 'the route only answers GET')
    })
  })
})

await test('serve-hmr', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo)
    const server = await serve(project.dir, ports, [...DEV_SERVER, '--hmr'])
    let stopped = false
    try {
      const home = await getJson(`${server.url}/`)
      assert.ok(isRecord(home.json) && isRecord(home.json.dms))
      assert.equal(home.json.dms.running, true)
      stopped = true
      assert.equal(await server.stop(), true, 'SIGINT ended the server')
      await assert.rejects(fetch(`${server.url}/`), 'the port is closed after the stop')
    } finally {
      if (!stopped) await server.stop()
    }
  })
})
