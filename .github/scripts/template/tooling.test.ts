import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { copyProject, mustRun, pointTestEnv, run, withMongo } from './stack.ts'

await test('lint-typecheck', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  for (const script of ['typecheck', 'lint', 'format:check', 'knip']) {
    const result = await run('pnpm', ['run', script], { cwd: project.dir })
    assert.equal(result.code, 0, `pnpm run ${script}:\n${result.output.slice(-4000)}`)
  }
})

await test('lint-rejects', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const broken = join(project.dir, 'start/broken.ts')
  writeFileSync(broken, "export const broken: number = 'text'\n")
  const typecheck = await run('pnpm', ['run', 'typecheck'], { cwd: project.dir })
  assert.notEqual(typecheck.code, 0, 'typecheck failed')
  assert.match(typecheck.output, /not assignable to type 'number'/)
  writeFileSync(broken, 'debugger\nexport {}\n')
  const lint = await run('pnpm', ['run', 'lint'], { cwd: project.dir })
  assert.notEqual(lint.code, 0, 'lint failed')
  assert.match(lint.output, /debugger/)
})

await test('checks', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const cwd = project.dir
  await withMongo(async (mongo) => {
    await pointTestEnv(cwd, mongo)
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
        'initial',
      ],
      { cwd }
    )
    const checks = await run('pnpm', ['run', 'checks'], { cwd, timeoutMs: 600_000 })
    assert.equal(checks.code, 0, checks.output.slice(-6000))
  })
})
