import { readFileSync } from "node:fs";
import { join } from "node:path";

import { equal, exists, exitIs, has, type Journey } from "@antelopejs/tooling-configs/verify";

import { abandon, scaffoldTree, freePort, prepared, type Server, serve, sleep, stop, withMongo, writeEnv } from "./stack.ts";

const SCRIPTS_IN_README = ["dev", "frontend:build", "frontend:start", "checks"];

/** Points `.env.test` at the run's MongoDB and free ports: the tests boot the whole application. */
async function testEnv(project: string, mongoPort: number): Promise<{ file: string; text: string }> {
  const api = await freePort();
  let text = readFileSync(join(project, ".env.test"), "utf8");
  const values = { MONGODB_URL: `mongodb://127.0.0.1:${mongoPort}`, DMS_API_PORT: String(api), DMS_API_BASE_URL: `http://localhost:${api}`, PORT: String(await freePort()) };
  for (const [name, value] of Object.entries(values)) text = text.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`);
  return { file: join(project, ".env.test"), text };
}

interface Manifest {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

function manifestOf(project: string): Manifest {
  // SAFETY: the project's package.json is JSON with these three objects of strings.
  return JSON.parse(readFileSync(join(project, "package.json"), "utf8")) as Manifest;
}

export const projectJourneys = {
  "test-suite": {
    title: "`pnpm test` boots the application against MongoDB and runs both specs green",
    entryPoint: "`pnpm test` in the project",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const env = await testEnv(project, mongo.port);
        context.edit("point .env.test at the run", env.file, env.text);
        const test = await context.command("pnpm test", "pnpm", ["test"], { cwd: project, timeoutMs: 180_000 });
        context.expect(test.folder, [
          exitIs(test, 0),
          has("two tests passed", test.stdout, /2 passed \(2\)/),
        ]);
      });
    },
  },
  "test-fails": {
    title: "a failing spec added to the project makes `pnpm test` fail and be reported",
    entryPoint: "`pnpm test` after adding `tests/unit/broken.spec.ts`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const env = await testEnv(project, mongo.port);
        context.edit("point .env.test at the run", env.file, env.text);
        context.edit("add a failing spec", join(project, "tests/unit/broken.spec.ts"), "import { test } from '@japa/runner'\n\ntest('verify-broken', ({ assert }) => {\n  assert.equal(1, 2)\n})\n");
        const test = await context.command("pnpm test", "pnpm", ["test"], { cwd: project, timeoutMs: 180_000 });
        context.expect(test.folder, [equal("the run failed", test.exitCode !== 0 && test.exitCode !== null, true), has("the failing spec is named", test.stdout + test.stderr, /verify-broken/)]);
      });
    },
  },
  "lint-typecheck": {
    title: "the project passes its typecheck, lint, format check and knip",
    entryPoint: "`pnpm run typecheck`, `lint`, `format:check` and `knip`",
    async run(context) {
      const project = await prepared(context);
      for (const script of ["typecheck", "lint", "format:check", "knip"]) {
        const done = await context.command(`pnpm run ${script}`, "pnpm", ["run", script], { cwd: project });
        context.expect(done.folder, [exitIs(done, 0)]);
      }
    },
  },
  "lint-rejects": {
    title: "typecheck rejects a wrongly typed assignment and lint rejects a debugger statement, so the configs are live",
    entryPoint: "`pnpm run typecheck` and `pnpm run lint` after editing `start/`",
    async run(context) {
      const project = await prepared(context);
      context.edit("add a type error", join(project, "start/broken.ts"), "export const broken: number = 'text'\n");
      const typecheck = await context.command("pnpm run typecheck", "pnpm", ["run", "typecheck"], { cwd: project });
      context.expect(typecheck.folder, [equal("typecheck failed", typecheck.exitCode !== 0, true), has("typecheck output", typecheck.stdout + typecheck.stderr, /not assignable to type 'number'/)]);
      context.edit("replace it with a debugger statement", join(project, "start/broken.ts"), "debugger\nexport {}\n");
      const lint = await context.command("pnpm run lint", "pnpm", ["run", "lint"], { cwd: project });
      context.expect(lint.folder, [equal("lint failed", lint.exitCode !== 0, true), has("lint output", lint.stdout + lint.stderr, /debugger/)]);
    },
  },
  checks: {
    title: "`pnpm run checks` passes in a fresh clone with MongoDB at hand",
    entryPoint: "`pnpm run checks` in a git repository holding the project",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const env = await testEnv(project, mongo.port);
        context.edit("point .env.test at the run", env.file, env.text);
        const init = await context.command("git init and commit", "sh", [
          "-c",
          "git init -q && git add -A && git -c user.name=verify -c user.email=verify@example.invalid commit -q -m initial",
        ], { cwd: project });
        context.expect(init.folder, [exitIs(init, 0)], { critical: true });
        const checks = await context.command("pnpm run checks", "pnpm", ["run", "checks"], { cwd: project, timeoutMs: 300_000 });
        context.expect(checks.folder, [exitIs(checks, 0)]);
      });
    },
  },
  "build-output": {
    title: "`pnpm build` compiles the application into `build/` with the server entry, the ace entry and the manifest",
    entryPoint: "`pnpm build` in the project",
    async run(context) {
      const project = await prepared(context);
      const build = await context.command("pnpm build", "pnpm", ["build"], { cwd: project, timeoutMs: 180_000 });
      context.expect(build.folder, [
        exitIs(build, 0),
        exists(join(project, "build/bin/server.js")),
        exists(join(project, "build/ace.js")),
        exists(join(project, "build/package.json")),
        exists(join(project, "build/providers/antelope_provider.js")),
        exists(join(project, "build/start/routes.js")),
      ]);
      context.tree("build output", join(project, "build"));
    },
  },
  dashboard: {
    title: "`pnpm frontend:build` then `pnpm frontend:start` serve the dashboard's first-run wizard against the running backend",
    entryPoint: "`pnpm frontend:build`, `pnpm frontend:start -p <port>` and `GET /`",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        let server: Server | undefined;
        let dashboard: number | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const build = await context.command("pnpm frontend:build", "pnpm", ["frontend:build"], { cwd: project, timeoutMs: 600_000 });
          context.expect(build.folder, [exitIs(build, 0)], { critical: true });
          const port = await freePort();
          const started = await context.command("pnpm frontend:start", "sh", ["-c", `pnpm frontend:start -p ${port} > dashboard.log 2>&1 & echo $! > dashboard.pid`], { cwd: project });
          context.expect(started.folder, [exitIs(started, 0)], { critical: true });
          dashboard = port;
          let page = await context.http("GET the dashboard", `http://localhost:${port}/`);
          for (let attempt = 0; attempt < 60 && page.status !== 200; attempt += 1) {
            await sleep(1000);
            page = await context.http(`GET the dashboard (${attempt + 2})`, `http://localhost:${port}/`);
          }
          context.expect(page.folder, [equal("the dashboard answers", page.status, 200), has("an HTML page", page.body, /<html/i)]);
        } finally {
          if (dashboard !== undefined) await context.command("stop the dashboard", "pkill", ["-f", "--", `-p ${dashboard}`]);
          if (server) await stop(context, server, "stop");
          await abandon(context, server);
        }
      });
    },
  },
  "docs-commands": {
    title: "what the README claims is true of the scaffolded project: its commands are scripts, its variables and ports are in `.env.example` and `start/env.ts`, its route is served, and its compatibility table matches `package.json`",
    entryPoint: "reading `README.md` of a scaffolded project",
    async run(context) {
      const project = await scaffoldTree(context);
      const manifest = manifestOf(project);
      const readme = readFileSync(join(project, "README.md"), "utf8");
      const example = readFileSync(join(project, ".env.example"), "utf8");
      const env = readFileSync(join(project, "start/env.ts"), "utf8");
      const routes = readFileSync(join(project, "start/routes.ts"), "utf8");
      const named = [...new Set([...readme.matchAll(/pnpm (?:run )?([a-z][\w:-]*)/g)].map((match) => match[1] ?? ""))].filter((name) => !["install", "add", "format"].includes(name));
      const variables = [...new Set([...readme.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]+)`/g)].map((match) => match[1] ?? ""))];
      const curled = [...readme.matchAll(/curl http:\/\/localhost:(\d+)(\/\S*)/g)];
      const compatibility = [...readme.matchAll(/^\| `(@[\w/-]+)`\s+\| `([^`]+)`/gm)].map((match) => ({ name: match[1] ?? "", range: match[2] ?? "" }));
      const declared: Record<string, string> = { ...manifest.dependencies, ...manifest.devDependencies };
      const port = (name: string) => new RegExp(`^${name}=(\\d+)`, "m").exec(example)?.[1];
      context.expect(context.tree("project files", project).folder, [
        equal("README commands without a script", named.filter((name) => !manifest.scripts[name]), []),
        equal("the documented scripts are named", SCRIPTS_IN_README.filter((name) => !named.includes(name)), []),
        equal("README variables missing from .env.example or start/env.ts", variables.filter((name) => !new RegExp(`^${name}=`, "m").test(example) || !env.includes(name)), []),
        equal("README names MONGODB_URL", variables.includes("MONGODB_URL"), true),
        equal("README curl routes missing from start/routes.ts", curled.filter((match) => !routes.includes(`'${match[2]}'`)).map((match) => match[2]), []),
        equal("the curl port is the AdonisJS port of .env.example", curled.map((match) => match[1]), curled.map(() => port("PORT"))),
        has("the README names the DMS API port of .env.example", readme, new RegExp(`localhost:${port("DMS_API_PORT")}\\b`)),
        equal("compatibility rows whose range differs from package.json", compatibility.filter((row) => declared[row.name] !== undefined && declared[row.name] !== row.range).map((row) => row.name), []),
        equal("the compatibility table lists the DMS and AntelopeJS core", ["@antelopejs/core", "@antelopejs/dms"].filter((name) => !compatibility.some((row) => row.name === name)), []),
      ]);
    },
  },
  gitignore: {
    title: "git ignores `.env`, dependencies, build output and the runtime cache, and keeps sources tracked",
    entryPoint: "`git check-ignore` in a clone after install and build",
    async run(context) {
      const project = await prepared(context);
      const build = await context.command("pnpm build", "pnpm", ["build"], { cwd: project, timeoutMs: 180_000 });
      context.expect(build.folder, [exitIs(build, 0)], { critical: true });
      context.edit("create a .env", join(project, ".env"), "APP_KEY=verify\n");
      const init = await context.command("git init", "git", ["init", "-q"], { cwd: project });
      context.expect(init.folder, [exitIs(init, 0)], { critical: true });
      for (const path of [".env", ".env.local", "node_modules/x", "build/x", ".antelope/x", "tmp/x"]) {
        const ignored = await context.command(`git check-ignore ${path}`, "git", ["check-ignore", "-q", path], { cwd: project });
        context.expect(ignored.folder, [equal(`${path} is ignored`, ignored.exitCode, 0)]);
      }
      for (const path of ["providers/antelope_provider.ts", ".env.example", ".env.test", "package.json"]) {
        const kept = await context.command(`git check-ignore ${path}`, "git", ["check-ignore", "-q", path], { cwd: project });
        context.expect(kept.folder, [equal(`${path} is not ignored`, kept.exitCode, 1)]);
      }
      const others = await context.command("untracked files", "git", ["ls-files", "--others", "--exclude-standard"], { cwd: project });
      const leaked = others.stdout.split("\n").filter((path) => /^(node_modules|build|tmp|\.antelope)\/|^\.env$/.test(path));
      context.expect(others.folder, [equal("no secret, dependency or build file is left untracked", leaked, [])]);
    },
  },
} satisfies Record<string, Journey>;

