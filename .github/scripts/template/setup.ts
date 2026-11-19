import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { mustRun } from './stack.ts'

const REPOSITORY = resolve(import.meta.dirname, '../../..')
const TEMPLATE_NAME = 'DMS Adonis'
const AJS = join(REPOSITORY, 'node_modules/@antelopejs/core/dist/core/cli/index.js')

/** Commits every file of `folder` and returns the `file://` URL of a bare clone of it. */
async function bareRepository(folder: string): Promise<string> {
  const cwd = folder
  await mustRun('git', ['init', '-q', '-b', 'main'], { cwd })
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
      'snapshot',
    ],
    { cwd }
  )
  await mustRun('git', ['clone', '-q', '--bare', folder, `${folder}.git`], { cwd: dirname(folder) })
  return `file://${folder}.git`
}

/** Copies the template's working tree, uncommitted changes included, the way `antelopejs-verify` serves it. */
async function copyWorkingTree(target: string): Promise<void> {
  const listed = await mustRun(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: REPOSITORY,
    }
  )
  for (const file of new Set(listed.stdout.split('\0').filter(Boolean))) {
    const source = join(REPOSITORY, file)
    const stat = lstatSync(source, { throwIfNoEntry: false })
    if (stat === undefined) continue
    mkdirSync(dirname(join(target, file)), { recursive: true })
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(source), join(target, file))
    else copyFileSync(source, join(target, file))
  }
}

/**
 * Scaffolds the project once for every test file, the way a user does: `ajs project init
 * --template` from an offline interfaces manifest listing the working tree, then `pnpm install
 * --frozen-lockfile`. `ajs` runs with a HOME of its own, so the user's `ajs` configuration is
 * left alone, and with the caller's pnpm store, which the later installs of the tests share.
 */
export async function globalSetup(): Promise<void> {
  const folder = mkdtempSync(
    join(process.env.TEMPLATE_TESTS_TMPDIR ?? tmpdir(), 'template-dms-adonis-tests-')
  )
  process.env.TEMPLATE_TESTS_ROOT = folder
  const sources = join(folder, 'sources')
  const template = join(sources, 'template')
  const interfaces = join(sources, 'interfaces')
  mkdirSync(template, { recursive: true })
  mkdirSync(interfaces, { recursive: true })
  await copyWorkingTree(template)
  const manifest = {
    interfaces: {},
    starredInterfaces: [],
    templates: [],
    projectTemplates: [
      {
        name: TEMPLATE_NAME,
        repository: await bareRepository(template),
        branch: 'main',
        packageManager: 'pnpm',
      },
    ],
  }
  writeFileSync(join(interfaces, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const manifestUrl = await bareRepository(interfaces)

  const home = join(folder, 'home')
  mkdirSync(home)
  const store = await mustRun('pnpm', ['store', 'path'], { cwd: REPOSITORY })
  const env = { HOME: home, npm_config_store_dir: store.stdout.trim() }
  await mustRun('node', [AJS, 'config', 'set', 'git', manifestUrl], { cwd: folder, env })
  await mustRun(
    'node',
    [AJS, 'project', 'init', 'scaffold', '--template', TEMPLATE_NAME, '--pm', 'pnpm', '--git-init'],
    {
      cwd: folder,
      env,
      timeoutMs: 600_000,
    }
  )
  await mustRun('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
    cwd: join(folder, 'scaffold'),
    timeoutMs: 600_000,
  })
}

export function globalTeardown(): void {
  const folder = process.env.TEMPLATE_TESTS_ROOT
  if (folder && !process.env.TEMPLATE_TESTS_KEEP) rmSync(folder, { recursive: true, force: true })
}
