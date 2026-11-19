import { spawn, type ChildProcess } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type AddressInfo, type Server as NetServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

export { sleep }

/** The database `.env.example` names, where the DMS writes by default. */
export const DEFAULT_DATABASE = 'template_dms_adonis'
export const SYSTEM_DATABASES = ['admin', 'config', 'local']
/** The modules `providers/antelope_provider.ts` lists, which `/` reports as loaded. */
export const EXPECTED_MODULES = [
  '@antelopejs/dms',
  '@antelopejs/dms-api',
  '@antelopejs/dms-database',
  '@antelopejs/dms-automation',
  '@antelopejs/dms-saas',
  '@antelopejs/dms-lang',
  '@antelopejs/dms-media',
  '@antelopejs/dms-marketing',
  '@antelopejs/dms-mailing',
  'template-dms-demo',
  '@antelopejs/api',
  '@antelopejs/mongodb',
  '@antelopejs/auth-jwt',
  '@antelopejs/file-storage-local',
  '@antelopejs/nodemailer',
]
export const DEMO_FRONTEND_MODULE = 'template-dms-demo-frontend-vue'

const BOOT_TIMEOUT_MS = 120_000
const STOP_TIMEOUT_MS = 20_000
const COMMAND_TIMEOUT_MS = 300_000

/** The folder the global setup prepares: the installed scaffold and the scratch space of each test. */
export function root(): string {
  const folder = process.env.TEMPLATE_TESTS_ROOT
  if (!folder)
    throw new Error(
      'TEMPLATE_TESTS_ROOT is unset: run the tests with setup.ts as --test-global-setup'
    )
  return folder
}

/** The project `ajs project init --template` scaffolded from the working tree and installed, shared read-only by every test. */
export function scaffolded(): string {
  return join(root(), 'scaffold')
}

/**
 * The variables of the caller's run that a user's project never sees: those that turn a nested
 * `node` into a `node --test` child, and those of this repository's CI run (its pull request
 * base and tier), which `antelopejs-checks` would otherwise apply to the scaffolded project.
 */
const CALLER_ONLY = /^(NODE_TEST_CONTEXT|NODE_OPTIONS|GITHUB_\w+|ANTELOPEJS_\w+)$/

/** The environment of every command a test runs: the test's own, without `CALLER_ONLY`. */
export function commandEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const own = Object.entries(process.env).filter(([name]) => !CALLER_ONLY.test(name))
  return { ...Object.fromEntries(own), ...extra }
}

export interface CommandResult {
  code: number | null
  stdout: string
  stderr: string
  output: string
}

export interface CommandOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}

/** Runs a command to its end, or kills its process group once `timeoutMs` passes. */
export function run(
  program: string,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: commandEnv(options.env),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    const timer = setTimeout(() => killGroup(child), options.timeoutMs ?? COMMAND_TIMEOUT_MS)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, output: stdout + stderr })
    })
  })
}

/** Runs a command that must succeed, and throws with its output otherwise. */
export async function mustRun(
  program: string,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  const result = await run(program, args, options)
  if (result.code !== 0) {
    throw new Error(
      `${program} ${args.join(' ')} exited ${result.code}:\n${result.output.slice(-4000)}`
    )
  }
  return result
}

function killGroup(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

function isTcpAddress(address: ReturnType<NetServer['address']>): address is AddressInfo {
  return address !== null && typeof address !== 'string'
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!isTcpAddress(address)) {
        server.close()
        reject(new Error(`the server reported ${String(address)} instead of a TCP address`))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

export interface Project {
  dir: string
  remove(): void
}

/** A copy of the installed scaffold, which a test may change, removed by `remove`. */
export function copyProject(): Project {
  const dir = mkdtempSync(join(root(), 'project-'))
  cpSync(scaffolded(), dir, { recursive: true, verbatimSymlinks: true })
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) }
}

export interface Mongo {
  name: string
  port: number
  url: string
}

/** Runs `body` with a MongoDB container of its own, removed afterwards even when `body` throws. */
export async function withMongo<T>(body: (mongo: Mongo) => Promise<T>): Promise<T> {
  const cwd = root()
  const name = `template-dms-adonis-test-${process.pid}-${Date.now().toString(36)}`
  try {
    await mustRun('docker', ['run', '-d', '--name', name, '-p', '127.0.0.1::27017', 'mongo:7'], {
      cwd,
    })
    const published = await mustRun('docker', ['port', name, '27017/tcp'], { cwd })
    const port = Number(published.stdout.trim().split('\n')[0]?.split(':').pop())
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`docker published ${published.stdout}`)
    }
    for (let attempt = 0; ; attempt += 1) {
      const ping = await run(
        'docker',
        ['exec', name, 'mongosh', '--quiet', '--eval', 'db.adminCommand("ping").ok'],
        { cwd }
      )
      if (ping.code === 0) break
      if (attempt === 60) throw new Error(`MongoDB never answered a ping:\n${ping.output}`)
      await sleep(1000)
    }
    return await body({ name, port, url: `mongodb://127.0.0.1:${port}` })
  } finally {
    await run('docker', ['rm', '-f', name], { cwd })
  }
}

/** Evaluates a mongosh script in the container and returns what it printed. */
export async function mongosh(mongo: Mongo, script: string): Promise<string> {
  const result = await mustRun(
    'docker',
    ['exec', mongo.name, 'mongosh', '--quiet', '--eval', script],
    {
      cwd: root(),
    }
  )
  return result.stdout.trim()
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

/** Reads a file of the installed scaffold. */
export function readScaffolded(file: string): string {
  return readFileSync(join(scaffolded(), file), 'utf8')
}

async function stringArray(mongo: Mongo, script: string): Promise<string[]> {
  const output = await mongosh(mongo, `JSON.stringify(${script})`)
  const parsed: unknown = JSON.parse(output)
  if (!isStringArray(parsed))
    throw new Error(`mongosh printed ${output} instead of a JSON array of strings`)
  return parsed
}

export function databases(mongo: Mongo): Promise<string[]> {
  return stringArray(
    mongo,
    'db.adminCommand({ listDatabases: 1 }).databases.map((entry) => entry.name).sort()'
  )
}

export function collections(mongo: Mongo, database: string): Promise<string[]> {
  return stringArray(mongo, `db.getSiblingDB('${database}').getCollectionNames().sort()`)
}

export async function connections(mongo: Mongo): Promise<number> {
  return Number(await mongosh(mongo, 'db.serverStatus().connections.current'))
}

/** Replaces the value of each `NAME=` line of an env file. */
export function setEnvValues(file: string, values: Record<string, string>): void {
  let text = readFileSync(file, 'utf8')
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`)
  }
  writeFileSync(file, text)
}

export interface Ports {
  http: number
  api: number
}

/** Writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), then points it at the test's MongoDB and free ports. */
export async function writeEnv(
  project: string,
  mongo: Mongo,
  overrides: Record<string, string> = {}
): Promise<Ports> {
  await mustRun('cp', ['.env.example', '.env'], { cwd: project })
  await mustRun('node', ['ace', 'generate:key'], { cwd: project })
  const ports = { http: await freePort(), api: await freePort() }
  setEnvValues(join(project, '.env'), {
    PORT: String(ports.http),
    DMS_API_PORT: String(ports.api),
    DMS_API_BASE_URL: `http://localhost:${ports.api}`,
    MONGODB_URL: mongo.url,
    ...overrides,
  })
  return ports
}

/** Points `.env.test` at the test's MongoDB and free ports: `pnpm test` boots the whole application. */
export async function pointTestEnv(project: string, mongo: Mongo): Promise<void> {
  const api = await freePort()
  setEnvValues(join(project, '.env.test'), {
    MONGODB_URL: mongo.url,
    DMS_API_PORT: String(api),
    DMS_API_BASE_URL: `http://localhost:${api}`,
    PORT: String(await freePort()),
  })
}

export interface Server {
  url: string
  ports: Ports
  /** Everything the server printed so far. */
  log(): string
  /** Sends SIGINT and resolves whether the process ended by itself within 20 seconds; kills it otherwise. */
  stop(): Promise<boolean>
}

/** Starts `node ace serve` and resolves once `/dms/info` answers 200; rejects with the server's output when it dies or never answers. */
export async function serve(project: string, ports: Ports, args: string[] = []): Promise<Server> {
  const child = spawn('node', ['ace', 'serve', ...args], {
    cwd: project,
    env: commandEnv(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  const ended = () => child.exitCode !== null || child.signalCode !== null
  const url = `http://localhost:${ports.http}`
  const server: Server = {
    url,
    ports,
    log: () => output,
    async stop() {
      if (ended()) return true
      child.kill('SIGINT')
      const byItself = await Promise.race([exited.then(() => true), sleep(STOP_TIMEOUT_MS, false)])
      killGroup(child)
      return byItself
    },
  }
  const deadline = Date.now() + BOOT_TIMEOUT_MS
  while (!ended() && Date.now() < deadline) {
    const up = await fetch(`${url}/dms/info`).then(
      (response) => response.ok,
      () => false
    )
    if (up) return server
    await sleep(500)
  }
  killGroup(child)
  throw new Error(
    `node ace serve ${args.join(' ')} never answered /dms/info:\n${output.slice(-4000)}`
  )
}

/** Runs `body` against a started server and stops it afterwards, even when `body` throws. */
export async function withServer<T>(
  project: string,
  ports: Ports,
  body: (server: Server) => Promise<T>,
  args: string[] = []
): Promise<T> {
  const server = await serve(project, ports, args)
  try {
    return await body(server)
  } finally {
    await server.stop()
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Fetches `url` and parses its JSON body. */
export async function getJson(url: string): Promise<{ status: number; json: unknown }> {
  const response = await fetch(url)
  const json: unknown = await response.json()
  return { status: response.status, json }
}
