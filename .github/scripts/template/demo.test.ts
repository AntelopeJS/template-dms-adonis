import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  copyProject,
  DEFAULT_DATABASE,
  DEMO_FRONTEND_MODULE,
  getJson,
  mongosh,
  mustRun,
  root,
  withMongo,
  withServer,
  writeEnv,
} from './stack.ts'

await test('demo-content', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    const ports = await writeEnv(project.dir, mongo)
    await withServer(project.dir, ports, async (server) => {
      const info = await getJson(`${server.url}/dms/info`)
      assert.ok(
        JSON.stringify(info.json).includes(DEMO_FRONTEND_MODULE),
        'the demo frontend module is listed'
      )
      const home = await fetch(`http://localhost:${ports.api}/dms/page?path=/home`)
      assert.equal(home.status, 200, 'the demo home page is a DMS page')
      const customers = await mongosh(
        mongo,
        `db.getSiblingDB('${DEFAULT_DATABASE}')['template-dms-demo__helio_customers'].countDocuments()`
      )
      assert.ok(Number(customers) > 0, "Helio's customer fixtures are seeded")
    })
  })
})

await test('demo-sync', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const cwd = project.dir
  await mustRun('git', ['init', '-q'], { cwd })
  await mustRun('git', ['add', '-A'], { cwd })
  await mustRun(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-q',
      '-m',
      'scaffold',
    ],
    { cwd }
  )
  const source = mkdtempSync(join(root(), 'template-dms-demo-'))
  for (const folder of ['src', 'content', 'frontend-vue']) {
    cpSync(join(cwd, 'demo', folder), join(source, folder), {
      recursive: true,
      filter: (path) => !/node_modules|\.dms-types/.test(path),
    })
  }
  await mustRun('pnpm', ['-s', 'demo:sync', source], { cwd })
  const status = await mustRun('git', ['status', '--porcelain', 'demo'], { cwd })
  assert.equal(status.stdout.trim(), '', 'demo/ is unchanged')
  assert.ok(
    existsSync(join(cwd, 'demo/frontend-vue/.dms-types/tsconfig.json')),
    'the sync keeps the types pnpm install generated'
  )
})
