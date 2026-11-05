import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { equal, exitIs, type Journey } from "@antelopejs/tooling-configs/verify";

import { abandon, DEFAULT_DATABASE, DEMO_FRONTEND_MODULE, mongosh, prepared, type Server, serve, stop, withMongo, writeEnv } from "./stack.ts";

const DEMO_COLLECTION = "template-dms-demo__helio_customers";

export const demoJourneys = {
  "demo-content": {
    title: "the demo module boots inside AdonisJS: its home page is a DMS page, its frontend module reaches the dashboard and Helio's fixtures land in MongoDB",
    entryPoint: "`pnpm install`, `node ace serve`, then `GET /dms/info`, `GET <DMS API>/dms/page?path=/home` and the Helio customers collection",
    async run(context) {
      await withMongo(context, async (mongo) => {
        const project = await prepared(context);
        const ports = await writeEnv(context, project, mongo);
        let server: Server | undefined;
        try {
          server = await serve(context, project, "node ace serve", ports);
          const info = await context.http("GET /dms/info", `${server.url}/dms/info`);
          context.expect(info.folder, [equal("the demo frontend module is listed", JSON.stringify(info.json).includes(DEMO_FRONTEND_MODULE), true)]);
          const home = await context.http("GET /dms/page?path=/home", `http://localhost:${ports.api}/dms/page?path=/home`);
          context.expect(home.folder, [equal("the demo home page is a DMS page", home.status, 200)]);
          const count = await mongosh(context, "Helio customers", mongo, `db.getSiblingDB('${DEFAULT_DATABASE}')['${DEMO_COLLECTION}'].countDocuments()`);
          context.expect(count.folder, [exitIs(count, 0), equal("Helio's customer fixtures are seeded", Number(count.stdout.trim()) > 0, true)]);
        } finally {
          if (server) await stop(context, server, "stop");
          await abandon(context, server);
        }
      });
    },
  },
  "demo-sync": {
    title: "`pnpm demo:sync` copies a template-dms-demo checkout into `demo/`: a checkout holding the same files leaves `git diff demo/` empty",
    entryPoint: "`pnpm demo:sync <template-dms-demo checkout>`, then `git status --porcelain demo`",
    async run(context) {
      const project = await prepared(context);
      for (const [step, args] of [
        ["git init", ["init", "-q"]],
        ["git add", ["add", "-A"]],
        ["git commit", ["-c", "user.name=verify", "-c", "user.email=verify@example.com", "commit", "-q", "-m", "scaffold"]],
      ] as const) {
        const git = await context.command(step, "git", [...args], { cwd: project });
        context.expect(git.folder, [exitIs(git, 0)], { critical: true });
      }
      const source = join(context.work, "template-dms-demo");
      mkdirSync(source, { recursive: true });
      for (const folder of ["src", "content", "frontend-vue"]) {
        cpSync(join(project, "demo", folder), join(source, folder), { recursive: true, filter: (path) => !path.includes("node_modules") });
      }
      const sync = await context.command("pnpm demo:sync", "pnpm", ["-s", "demo:sync", source], { cwd: project });
      context.expect(sync.folder, [exitIs(sync, 0)], { critical: true });
      const status = await context.command("git status demo", "git", ["status", "--porcelain", "demo"], { cwd: project });
      context.expect(status.folder, [exitIs(status, 0), equal("demo/ is unchanged", status.stdout.trim(), "")]);
    },
  },
} satisfies Record<string, Journey>;
