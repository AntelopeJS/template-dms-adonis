import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { copyProject, pointTestEnv, run, withMongo } from './stack.ts'

await test('test-suite', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    await pointTestEnv(project.dir, mongo)
    const result = await run('pnpm', ['test'], { cwd: project.dir })
    assert.equal(result.code, 0, result.output.slice(-4000))
    assert.match(result.stdout, /\b([1-9]\d*) passed \(\1\)/, 'every spec passed')
  })
})

await test('test-fails', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  await withMongo(async (mongo) => {
    await pointTestEnv(project.dir, mongo)
    writeFileSync(
      join(project.dir, 'tests/unit/broken.spec.ts'),
      "import { test } from '@japa/runner'\n\ntest('template-broken', ({ assert }) => {\n  assert.equal(1, 2)\n})\n"
    )
    const result = await run('pnpm', ['test'], { cwd: project.dir })
    assert.notEqual(result.code, 0, 'the run failed')
    assert.notEqual(result.code, null, 'the run ended by itself')
    assert.match(result.output, /template-broken/, 'the failing spec is named')
  })
})
