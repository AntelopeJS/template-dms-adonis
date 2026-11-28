import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  collections,
  connections,
  copyProject,
  databases,
  DEFAULT_DATABASE,
  getJson,
  isRecord,
  mongosh,
  run,
  serve,
  sleep,
  SYSTEM_DATABASES,
  withMongo,
  withServer,
  writeEnv,
  type Mongo,
} from './stack.ts'

const SETUP_LINE =
  /\[DMS\] No owner exists yet\. To create it, open (\S+)\/onboarding\?token=<DMS_SETUP_TOKEN>/

await test('config-mapping', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo, {
      DMS_CLIENT_BASE_URL: 'http://localhost:4242',
    })
    await withServer(project.dir, ports, async (server) => {
      const info = await getJson(`${server.url}/dms/info`)
      assert.ok(isRecord(info.json))
      assert.equal(
        info.json.clientBaseUrl,
        'http://localhost:4242',
        'the client base url follows .env'
      )
      const names = await databases(mongo)
      assert.deepEqual(
        names.filter((name) => !SYSTEM_DATABASES.includes(name)),
        [DEFAULT_DATABASE],
        'the only database the run created'
      )
      const written = await collections(mongo, DEFAULT_DATABASE)
      assert.ok(
        written.includes('dms-core__users'),
        'the DMS wrote its collections to the default database'
      )
    })
  })
})

await test('database-override', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo, { MONGODB_DATABASE: 'mapped' })
    await withServer(project.dir, ports, async () => {
      const names = await databases(mongo)
      assert.ok(names.includes('mapped'), 'the configured database exists')
      assert.ok(!names.includes(DEFAULT_DATABASE), 'the default database was never created')
      const mapped = await collections(mongo, 'mapped')
      assert.ok(
        mapped.includes('dms-core__users'),
        'the DMS wrote its collections to the configured database'
      )
    })
  })
})

await test('first-run-setup-token', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const token = 'template-test-runtime-setup-token'
    const ports = await writeEnv(project.dir, mongo, { DMS_SETUP_TOKEN: token })
    await withServer(project.dir, ports, async (server) => {
      let announced: RegExpExecArray | null = null
      for (let attempt = 0; attempt < 60 && !announced; attempt += 1) {
        announced = SETUP_LINE.exec(server.log())
        if (!announced) await sleep(500)
      }
      assert.ok(
        announced,
        `the terminal prints the onboarding address:\n${server.log().slice(-2000)}`
      )
      assert.equal(announced[1], 'http://localhost:3001', 'on the origin of DMS_CLIENT_BASE_URL')
      assert.ok(!server.log().includes(token), 'the terminal never prints the setup token')

      const api = `http://localhost:${ports.api}/api/onboarding`
      const before = await getJson(`${api}/informations`)
      assert.ok(isRecord(before.json))
      assert.equal(before.json.has_onboarded, false)
      const forged = await register(api, `${token}x`)
      assert.equal(forged, 403, 'another token is refused')
      const registered = await register(api, token)
      assert.equal(registered, 200, 'DMS_SETUP_TOKEN creates the administrator')
      const after = await getJson(`${api}/informations`)
      assert.ok(isRecord(after.json))
      assert.equal(after.json.has_onboarded, true)
      const owners = await mongosh(
        mongo,
        `db.getSiblingDB('${DEFAULT_DATABASE}').getCollection('dms-core__users').countDocuments({ owner: true })`
      )
      assert.equal(owners, '1', 'one owner exists')
    })
  })
})

async function register(api: string, setupToken: string): Promise<number> {
  const response = await fetch(`${api}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Owner',
      email: 'owner@example.invalid',
      password: 'Test0wner!',
      setupToken,
      platformName: 'Test',
    }),
  })
  return response.status
}

await test('missing-env', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const started = await run('node', ['ace', 'serve'], { cwd: project.dir, timeoutMs: 60_000 })
  assert.notEqual(started.code, 0, 'the process failed')
  assert.notEqual(started.code, null, 'the process exited by itself')
  assert.match(started.output, /Missing environment variable "APP_KEY"/)
  assert.match(started.output, /Missing environment variable "MONGODB_URL"/)
  assert.doesNotMatch(started.output, /started HTTP server/)
})

await test('mongo-unreachable', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    await writeEnv(project.dir, mongo, { MONGODB_URL: 'mongodb://127.0.0.1:1' })
    const started = await run('node', ['ace', 'serve'], { cwd: project.dir, timeoutMs: 120_000 })
    assert.notEqual(started.code, 0, 'the process failed')
    assert.notEqual(started.code, null, 'the process exited by itself')
    assert.match(started.output, /ModuleManager\.constructAll|constructModules/)
    assert.doesNotMatch(started.output, /started HTTP server/)
    const names = await databases(mongo)
    assert.ok(!names.includes(DEFAULT_DATABASE), 'MongoDB received no database')
  })
})

const SERVER_APP_NAME = 'template-restart-persistence'

/** Reads the server's connection count until it reaches 0 or five seconds pass, so a close still in flight is not counted. */
async function settledConnections(mongo: Mongo): Promise<number> {
  let latest = await connections(mongo, SERVER_APP_NAME)
  for (let attempt = 0; attempt < 10 && latest !== 0; attempt += 1) {
    await sleep(500)
    latest = await connections(mongo, SERVER_APP_NAME)
  }
  return latest
}

await test('restart-persistence', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo, {
      MONGODB_URL: `${mongo.url}/?appName=${SERVER_APP_NAME}`,
    })
    const first = await serve(project.dir, ports)
    try {
      assert.ok((await connections(mongo, SERVER_APP_NAME)) > 0, 'the server holds connections')
      const marked = await mongosh(
        mongo,
        `db.getSiblingDB('${DEFAULT_DATABASE}').getCollection('test_marker').insertOne({ _id: 'kept' }).acknowledged`
      )
      assert.equal(marked, 'true')
    } finally {
      assert.equal(await first.stop(), true, 'SIGINT ended the server')
    }
    assert.equal(await settledConnections(mongo), 0, 'every connection of the server is closed')
    const before = await collections(mongo, DEFAULT_DATABASE)
    await withServer(project.dir, ports, async () => {
      const marker = await mongosh(
        mongo,
        `JSON.stringify(db.getSiblingDB('${DEFAULT_DATABASE}').getCollection('test_marker').findOne({ _id: 'kept' }))`
      )
      assert.match(marker, /"_id":"kept"/, 'the marker survived the restart')
      const after = await collections(mongo, DEFAULT_DATABASE)
      assert.deepEqual(
        before.filter((name) => !after.includes(name)),
        [],
        'the second start lost no collection of the first'
      )
    })
  })
})
