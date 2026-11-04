import { equal, has, lacks, refused, type HttpResult, type Journey } from "@antelopejs/tooling-configs/verify";

import {
  abandon,
  collections,
  connections,
  databases,
  DEFAULT_DATABASE,
  EXPECTED_MODULES,
  SYSTEM_DATABASES,
  mongosh,
  prepared,
  type Server,
  serve,
  settledConnections,
  stop,
  withMongo,
  writeEnv,
} from "./stack.ts";

interface Home {
  host?: string;
  dms?: { running?: boolean; modules?: string[] };
}

interface Info {
  servedBy?: string;
  clientBaseUrl?: string;
  frontendModules?: string[];
}

type Json = HttpResult["json"];

function isRecord(value: Json): value is Exclude<Json, string | number | boolean | null | unknown[] | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: Json): value is string {
  return typeof value === "string";
}

function isBoolean(value: Json): value is boolean {
  return typeof value === "boolean";
}

function isStrings(value: Json): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function homeOf(result: HttpResult): Home {
  const root = result.json;
  if (!isRecord(root)) return {};
  const dms = root.dms;
  const home: Home = {};
  if (isString(root.host)) home.host = root.host;
  if (isRecord(dms)) {
    home.dms = {};
    if (isBoolean(dms.running)) home.dms.running = dms.running;
    if (isStrings(dms.modules)) home.dms.modules = dms.modules;
  }
  return home;
}

function infoOf(result: HttpResult): Info {
  const root = result.json;
  if (!isRecord(root)) return {};
  const info: Info = {};
  if (isString(root.servedBy)) info.servedBy = root.servedBy;
  if (isString(root.clientBaseUrl)) info.clientBaseUrl = root.clientBaseUrl;
  if (isStrings(root.frontendModules)) info.frontendModules = root.frontendModules;
  return info;
}

export const runJourneys = {
  "serve-structure": {
    title: "`node ace serve` boots the DMS inside AdonisJS: `/` and `/dms/info` answer the documented shapes and MongoDB holds the DMS collections",
    entryPoint: "`node ace serve`, then `GET /` and `GET /dms/info`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const home = await context.http("GET /", `${server.url}/`);
          const root = homeOf(home);
          context.expect(home.folder, [
            equal("status", home.status, 200),
            equal("served by adonisjs", root.host, "adonisjs"),
            equal("the runtime is running", root.dms?.running, true),
            equal("every module of the provider is loaded", EXPECTED_MODULES.filter((name) => !root.dms?.modules?.includes(name)), []),
          ]);
          const info = await context.http("GET /dms/info", `${server.url}/dms/info`);
          const dms = infoOf(info);
          context.expect(info.folder, [
            equal("served by adonis", dms.servedBy, "adonis"),
            equal("the client base url is the configured one", dms.clientBaseUrl, "http://localhost:3001"),
            equal("the dashboard module is listed", dms.frontendModules?.includes("@antelopejs/dms-frontend-vue"), true),
            equal("only module names are listed", (dms.frontendModules ?? []).filter((name) => !name.startsWith("@antelopejs/")), []),
          ]);
          const names = await collections(context, "MongoDB collections", mongo, DEFAULT_DATABASE);
          context.expect(context.tree("collections", project).folder, [
            equal("the DMS users collection exists", names.includes("dms-core__users"), true),
            equal("the runtime registered its instance", names.includes("__antelope_instances"), true),
          ]);
        } finally {
          if (server) {
            const ended = await stop(context, server, "stop");
            context.expect(context.tree("after stop", project).folder, [equal("SIGINT ended the server", ended, true)]);
          }
          await abandon(context, server);
        }
      });
    },
  },
  "not-found": {
    title: "an unknown route answers 404 and a known route with the wrong method does not answer 200",
    entryPoint: "`GET /nope`, `POST /dms/info`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const missing = await context.http("GET /nope", `${server.url}/nope`);
          context.expect(missing.folder, [equal("unknown route", missing.status, 404)]);
          const wrong = await context.http("POST /dms/info", `${server.url}/dms/info`, { method: "POST", body: "{}" });
          context.expect(wrong.folder, [equal("the route only answers GET", wrong.status, 404)]);
        } finally {
          if (server) await stop(context, server, "stop");
          await abandon(context, server);
        }
      });
    },
  },
  "serve-hmr": {
    title: "`node ace serve --hmr`, the `pnpm dev` command, boots and answers the same routes",
    entryPoint: "`node ace serve --hmr`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve --hmr", ports, ["--hmr"]);
          const home = await context.http("GET /", `${server.url}/`);
          context.expect(home.folder, [equal("the runtime is running", homeOf(home).dms?.running, true)]);
          const ended = await stop(context, server, "stop");
          context.expect(context.tree("after stop", project).folder, [equal("SIGINT ended the server", ended, true)]);
          const after = await context.http("GET / after stop", `${server.url}/`);
          context.expect(after.folder, [refused(after)]);
        } finally {
          await abandon(context, server);
        }
      });
    },
  },
  "config-mapping": {
    title: "the `.env` the README tells the user to copy decides where the DMS writes: the default `MONGODB_DATABASE` is the database every DMS collection lands in, and no other database is created",
    entryPoint: "`cp .env.example .env`, with `DMS_CLIENT_BASE_URL` changed, then `node ace serve`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo, { DMS_CLIENT_BASE_URL: "http://localhost:4242" });
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const info = await context.http("GET /dms/info", `${server.url}/dms/info`);
          context.expect(info.folder, [equal("the client base url follows .env", infoOf(info).clientBaseUrl, "http://localhost:4242")]);
          const names = await databases(context, "databases", mongo);
          const written = await collections(context, `collections of ${DEFAULT_DATABASE}`, mongo, DEFAULT_DATABASE);
          context.expect(context.tree("databases", project).folder, [
            equal("the databases the run created", names.filter((name) => !SYSTEM_DATABASES.includes(name)), [DEFAULT_DATABASE]),
            equal("the DMS wrote its collections to the default database", written.includes("dms-core__users"), true),
          ]);
        } finally {
          if (server) await stop(context, server, "stop");
          await abandon(context, server);
        }
      });
    },
  },
  "database-override": {
    title: "with another MONGODB_DATABASE every DMS collection lands there and the default database is never created",
    entryPoint: "`MONGODB_DATABASE` of `.env`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo, { MONGODB_DATABASE: "verify_mapped" });
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const names = await databases(context, "databases", mongo);
          const mapped = await collections(context, "collections of verify_mapped", mongo, "verify_mapped");
          context.expect(context.tree("databases", project).folder, [
            equal("the configured database exists", names.includes("verify_mapped"), true),
            equal("the default database was never created", names.includes(DEFAULT_DATABASE), false),
            equal("the DMS wrote its collections to the configured database", mapped.includes("dms-core__users"), true),
          ]);
        } finally {
          if (server) await stop(context, server, "stop");
          await abandon(context, server);
        }
      });
    },
  },
  "missing-env": {
    title: "without `.env` the server refuses to start and names the missing variables",
    entryPoint: "`node ace serve` in a project whose `.env` is missing",
    async run(context) {
      const project = await prepared(context);
      const started = await context.command("node ace serve without .env", "node", ["ace", "serve"], { cwd: project, timeoutMs: 60_000 });
      const output = started.stdout + started.stderr;
      context.expect(started.folder, [
        equal("the process failed", started.exitCode !== 0 && started.exitCode !== null, true),
        has("the missing APP_KEY is named", output, /Missing environment variable "APP_KEY"/),
        has("the missing MONGODB_URL is named", output, /Missing environment variable "MONGODB_URL"/),
        lacks("a started server", output, /started HTTP server/),
      ]);
    },
  },
  "mongo-unreachable": {
    title: "with no MongoDB at MONGODB_URL the runtime fails to construct its modules and the process exits non-zero, without ever answering",
    entryPoint: "`node ace serve` with a MONGODB_URL nobody answers",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        await writeEnv(context, project, mongo, { MONGODB_URL: "mongodb://127.0.0.1:1" });
        const started = await context.command("node ace serve without MongoDB", "node", ["ace", "serve"], { cwd: project, timeoutMs: 120_000 });
        const output = started.stdout + started.stderr;
        context.expect(started.folder, [
          equal("the process failed", started.exitCode !== 0 && started.exitCode !== null, true),
          has("the failure comes from the runtime construction", output, /ModuleManager\.constructAll|constructModules/),
          lacks("a started server", output, /started HTTP server/),
        ]);
        const names = await databases(context, "databases", mongo);
        context.expect(context.tree("databases", project).folder, [equal("the run's MongoDB received no database", names.includes(DEFAULT_DATABASE), false)]);
      });
    },
  },
  "restart-persistence": {
    title: "stopping closes every MongoDB connection of the server, and a second start finds the DMS data the first one wrote",
    entryPoint: "Ctrl+C on `node ace serve`, then `node ace serve` again",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        const baseline = await connections(context, "connections before the server", mongo);
        let server: Server | undefined;
        try {
          server = await serve(context, project, "first node ace serve", ports);
          const running = await connections(context, "connections while running", mongo);
          context.expect(context.tree("while running", project).folder, [equal("the server holds connections", running > baseline, true)]);
          const first = await mongosh(context, "mark the data", mongo, `db.getSiblingDB('${DEFAULT_DATABASE}').getCollection('verify_marker').insertOne({ _id: 'kept', at: 1 }).acknowledged`);
          context.expect(first.folder, [equal("the marker was written", first.stdout.trim(), "true")]);
          const ended = await stop(context, server, "first stop");
          const closed = await settledConnections(context, mongo, baseline);
          context.expect(context.tree("after stop", project).folder, [equal("SIGINT ended the server", ended, true), equal("every connection of the server is closed", closed, baseline)]);
          const before = await collections(context, "collections after the first run", mongo, DEFAULT_DATABASE);
          server = await serve(context, project, "second node ace serve", ports);
          const marker = await mongosh(context, "read the marker", mongo, `JSON.stringify(db.getSiblingDB('${DEFAULT_DATABASE}').getCollection('verify_marker').findOne({ _id: 'kept' }))`);
          const after = await collections(context, "collections after the second run", mongo, DEFAULT_DATABASE);
          context.expect(marker.folder, [
            has("the marker survived the restart", marker.stdout, /"_id":"kept"/),
            equal("the second start lost no collection of the first", before.filter((name) => !after.includes(name)), []),
          ]);
        } finally {
          if (server) await stop(context, server, "final stop");
          await abandon(context, server);
        }
      });
    },
  },
} satisfies Record<string, Journey>;

