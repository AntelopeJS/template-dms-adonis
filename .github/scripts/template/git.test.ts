import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { copyProject, mustRun, run } from './stack.ts'

await test('gitignore', async (t) => {
  const project = copyProject()
  t.after(() => project.remove())
  const cwd = project.dir
  await mustRun('pnpm', ['build'], { cwd })
  writeFileSync(join(cwd, '.env'), 'APP_KEY=test\n')
  await mustRun('git', ['init', '-q'], { cwd })
  for (const path of ['.env', '.env.local', 'node_modules/x', 'build/x', '.antelope/x', 'tmp/x']) {
    const ignored = await run('git', ['check-ignore', '-q', path], { cwd })
    assert.equal(ignored.code, 0, `${path} is ignored`)
  }
  for (const path of [
    'providers/antelope_provider.ts',
    '.env.example',
    '.env.test',
    'package.json',
  ]) {
    const kept = await run('git', ['check-ignore', '-q', path], { cwd })
    assert.equal(kept.code, 1, `${path} is not ignored`)
  }
  const others = await mustRun('git', ['ls-files', '--others', '--exclude-standard'], { cwd })
  assert.deepEqual(
    others.stdout
      .split('\n')
      .filter((path) => /^(node_modules|build|tmp|\.antelope)\/|^\.env$/.test(path)),
    [],
    'no secret, dependency or build file is left untracked'
  )
})
