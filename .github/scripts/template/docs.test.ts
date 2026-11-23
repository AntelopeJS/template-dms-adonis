import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isStringArray, readScaffolded } from './stack.ts'

const SCRIPTS_IN_README = ['dev', 'frontend:build', 'frontend:start', 'checks']

interface Manifest {
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    isStringArray(Object.values(value))
  )
}

function isManifest(value: unknown): value is Manifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scripts' in value &&
    isStringRecord(value.scripts) &&
    'dependencies' in value &&
    isStringRecord(value.dependencies) &&
    'devDependencies' in value &&
    isStringRecord(value.devDependencies)
  )
}

await test('docs-commands', () => {
  const read = readScaffolded
  const manifest: unknown = JSON.parse(read('package.json'))
  assert.ok(
    isManifest(manifest),
    'package.json holds scripts, dependencies and devDependencies of strings'
  )
  const readme = read('README.md')
  const example = read('.env.example')
  const env = read('start/env.ts')
  const routes = read('start/routes.ts')

  const named = [
    ...new Set(
      [...readme.matchAll(/pnpm (?:run )?([a-z][\w:-]*)/g)].map((match) => match[1] ?? '')
    ),
  ].filter((name) => !['install', 'add', 'format'].includes(name))
  assert.deepEqual(
    named.filter((name) => !manifest.scripts[name]),
    [],
    'README commands without a script'
  )
  assert.deepEqual(
    SCRIPTS_IN_README.filter((name) => !named.includes(name)),
    [],
    'the documented scripts are named'
  )

  const variables = [
    ...new Set(
      [...readme.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]+)`/g)].map((match) => match[1] ?? '')
    ),
  ]
  assert.deepEqual(
    variables.filter((name) => !new RegExp(`^${name}=`, 'm').test(example) || !env.includes(name)),
    [],
    'README variables missing from .env.example or start/env.ts'
  )
  assert.ok(variables.includes('MONGODB_URL'), 'README names MONGODB_URL')

  const port = (name: string) => new RegExp(`^${name}=(\\d+)`, 'm').exec(example)?.[1]
  const curled = [...readme.matchAll(/curl http:\/\/localhost:(\d+)(\/\S*)/g)]
  assert.deepEqual(
    curled.filter((match) => !routes.includes(`'${match[2]}'`)).map((match) => match[2]),
    [],
    'README curl routes missing from start/routes.ts'
  )
  assert.deepEqual(
    curled.map((match) => match[1]),
    curled.map(() => port('PORT') ?? ''),
    'the curl port is the AdonisJS port of .env.example'
  )
  assert.match(
    readme,
    new RegExp(`localhost:${port('DMS_API_PORT')}\\b`),
    'the README names the DMS API port of .env.example'
  )

  const compatibility =
    readme.split(/^## /m).find((section) => section.startsWith('Compatibility\n')) ?? ''
  const pinned = [...compatibility.matchAll(/`(@[\w/-]+)`/g)].map((match) => match[1] ?? '')
  const declared = { ...manifest.dependencies, ...manifest.devDependencies }
  assert.deepEqual(
    pinned.filter((name) => declared[name] === undefined),
    [],
    'packages the Compatibility section names that package.json does not declare'
  )
  assert.deepEqual(
    ['@antelopejs/core', '@antelopejs/dms'].filter((name) => !pinned.includes(name)),
    [],
    'the Compatibility section names the DMS and AntelopeJS core'
  )

  for (const [name, text] of [
    ['README.md', readme],
    ['.env.example', example],
  ] as const) {
    assert.doesNotMatch(text, /never prints/, `${name} says the DMS never prints the token`)
    assert.match(text, /development\s+(?:#\s*)?prints/, `${name} says development prints the token`)
    assert.match(
      text,
      /production\s+(?:#\s*)?shows `?<DMS_SETUP_TOKEN>/,
      `${name} says production shows the placeholder`
    )
  }
})
