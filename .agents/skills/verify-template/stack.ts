import { readFileSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { join } from "node:path";

import { equal, exists, exitIs, type CommandResult, type JourneyContext } from "@antelopejs/tooling-configs/verify";

export const DEFAULT_DATABASE = "template_dms_adonis";
export const SYSTEM_DATABASES = ["admin", "config", "local"];
export const EXPECTED_MODULES = ["@antelopejs/dms", "@antelopejs/api", "@antelopejs/mongodb", "@antelopejs/auth-jwt", "@antelopejs/file-storage-local", "@antelopejs/nodemailer"];
const BOOT_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 20_000;

export interface Mongo {
  name: string;
  port: number;
}

export interface Ports {
  http: number;
  api: number;
}

export interface Server {
  pid: number;
  ports: Ports;
  url: string;
  log: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      // SAFETY: a TCP server that listens on a port reports an AddressInfo, not a pipe path.
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Scaffolds the project the way a user does, with `ajs project init` from the run's offline manifest: the template's working tree under verification, uncommitted changes included. */
export async function scaffoldTree(context: JourneyContext): Promise<string> {
  const project = join(context.work, "app");
  const init = await context.scaffold("ajs project init", project);
  context.expect(init.folder, [exitIs(init, 0), exists(join(project, "antelope.config.ts"))], { critical: true });
  context.tree("project tree", project);
  return project;
}

export async function install(context: JourneyContext, project: string): Promise<void> {
  const done = await context.command("pnpm install --frozen-lockfile", "pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: project });
  context.expect(done.folder, [exitIs(done, 0)], { critical: true });
}

/** A project copy with its dependencies installed. */
export async function prepared(context: JourneyContext): Promise<string> {
  const project = await scaffoldTree(context);
  await install(context, project);
  return project;
}

/** Runs the journey body with a MongoDB container of its own, removed afterwards even when the journey aborts. */
export async function withMongo(context: JourneyContext, body: (mongo: Mongo) => Promise<void>): Promise<void> {
  const name = `${process.env.VERIFY_CONTAINER_PREFIX ?? "verify"}-template-dms-adonis-mongo-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  try {
    const started = await context.command("start MongoDB", "docker", ["run", "-d", "--name", name, "-p", "127.0.0.1::27017", "mongo:7"]);
    context.expect(started.folder, [exitIs(started, 0)], { critical: true });
    const published = await context.command("MongoDB port", "docker", ["port", name, "27017/tcp"]);
    const port = Number(published.stdout.trim().split("\n")[0]?.split(":").pop());
    context.expect(published.folder, [equal("a port was published", Number.isInteger(port) && port > 0, true)], { critical: true });
    const ready = await context.command("MongoDB ready", "sh", [
      "-c",
      `for i in $(seq 60); do docker exec ${name} mongosh --quiet --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1`,
    ]);
    context.expect(ready.folder, [exitIs(ready, 0)], { critical: true });
    await body({ name, port });
  } finally {
    await context.command("remove MongoDB", "docker", ["rm", "-f", name]);
  }
}

export function mongosh(context: JourneyContext, step: string, mongo: Mongo, script: string): Promise<CommandResult> {
  return context.command(step, "docker", ["exec", mongo.name, "mongosh", "--quiet", "--eval", script]);
}

export async function connections(context: JourneyContext, step: string, mongo: Mongo): Promise<number> {
  const read = await mongosh(context, step, mongo, "db.serverStatus().connections.current");
  return Number(read.stdout.trim());
}

/** Reads the connection count until it reaches `target` or five seconds pass, so a close still in flight is not counted. */
export async function settledConnections(context: JourneyContext, mongo: Mongo, target: number): Promise<number> {
  let latest = await connections(context, "connections after stop", mongo);
  for (let attempt = 0; attempt < 10 && latest !== target; attempt += 1) {
    await sleep(500);
    latest = await connections(context, `connections after stop (${attempt + 2})`, mongo);
  }
  return latest;
}

export async function databases(context: JourneyContext, step: string, mongo: Mongo): Promise<string[]> {
  const read = await mongosh(context, step, mongo, "JSON.stringify(db.adminCommand({ listDatabases: 1 }).databases.map((entry) => entry.name).sort())");
  // SAFETY: mongosh printed the JSON array the script built.
  return JSON.parse(read.stdout.trim()) as string[];
}

export async function collections(context: JourneyContext, step: string, mongo: Mongo, database: string): Promise<string[]> {
  const read = await mongosh(context, step, mongo, `JSON.stringify(db.getSiblingDB('${database}').getCollectionNames().sort())`);
  // SAFETY: mongosh printed the JSON array the script built.
  return JSON.parse(read.stdout.trim()) as string[];
}

export interface EnvOverrides {
  [key: string]: string;
}

/** Writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), then points it at the run's own MongoDB and free ports. */
export async function writeEnv(context: JourneyContext, project: string, mongo: Mongo, overrides: EnvOverrides = {}): Promise<Ports> {
  const copy = await context.command("cp .env.example .env", "cp", [".env.example", ".env"], { cwd: project });
  context.expect(copy.folder, [exitIs(copy, 0)], { critical: true });
  const key = await context.command("node ace generate:key", "node", ["ace", "generate:key"], { cwd: project });
  context.expect(key.folder, [exitIs(key, 0)], { critical: true });
  const ports = { http: await freePort(), api: await freePort() };
  const values: EnvOverrides = {
    PORT: String(ports.http),
    DMS_API_PORT: String(ports.api),
    DMS_API_BASE_URL: `http://localhost:${ports.api}`,
    MONGODB_URL: `mongodb://127.0.0.1:${mongo.port}`,
    ...overrides,
  };
  let text = readFileSync(join(project, ".env"), "utf8");
  for (const [name, value] of Object.entries(values)) text = text.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`);
  context.edit("point .env at the run", join(project, ".env"), text);
  return ports;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Starts `node ace serve` in the background and waits until `/dms/info` answers, or the process dies. */
export async function serve(context: JourneyContext, project: string, step: string, ports: Ports, args: string[] = []): Promise<Server> {
  const log = join(project, `server-${step.replace(/[^a-z0-9]+/gi, "-")}.log`);
  const pidFile = `${log}.pid`;
  const started = await context.command(step, "sh", ["-c", `node ace serve ${args.join(" ")} > ${log} 2>&1 & echo $! > ${pidFile}`], { cwd: project });
  context.expect(started.folder, [exitIs(started, 0)], { critical: true });
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  const url = `http://localhost:${ports.http}`;
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let up = false;
  while (!up && alive(pid) && Date.now() < deadline) {
    up = await fetch(`${url}/dms/info`).then((response) => response.ok, () => false);
    if (!up) await sleep(500);
  }
  const probe = await context.http(`${step}: ready`, `${url}/dms/info`);
  const server = { pid, ports, url, log };
  if (probe.status !== 200) {
    await context.command(`${step}: server log`, "cat", [log]);
    await abandon(context, server);
  }
  context.expect(probe.folder, [equal("/dms/info answers 200", probe.status, 200)], { critical: true });
  return server;
}

/** Sends SIGINT, waits for the exit, and records the server log. Returns whether the process ended by itself. */
export async function stop(context: JourneyContext, server: Server, step: string): Promise<boolean> {
  await context.command(`${step}: SIGINT`, "kill", ["-INT", String(server.pid)]);
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (alive(server.pid) && Date.now() < deadline) await sleep(250);
  const ended = !alive(server.pid);
  if (!ended) await context.command(`${step}: SIGKILL`, "sh", ["-c", `pkill -KILL -P ${server.pid}; kill -KILL ${server.pid}`]);
  await context.command(`${step}: server log`, "cat", [server.log]);
  return ended;
}

/** Stops whatever a journey left running; called from `finally`. */
export async function abandon(context: JourneyContext, server: Pick<Server, "pid"> | undefined): Promise<void> {
  if (server && alive(server.pid)) await context.command("kill the server left running", "sh", ["-c", `pkill -KILL -P ${server.pid}; kill -KILL ${server.pid}`]);
}
