# AntelopeJS DMS AdonisJS Template

<div align="center">
<a href="https://discord.gg/sjK28QHrA7"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord"></a>
<a href="https://dms.antelopejs.com/docs/getting-started/adonisjs"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation"></a>
</div>

An AdonisJS 6 application that runs the [AntelopeJS DMS](https://dms.antelopejs.com)
and its dashboard inside your own app, in **embedded** mode.

## What it does

- AdonisJS owns the process: its HTTP server, signals, logger and configuration.
  The DMS starts and stops with it, from `providers/antelope_provider.ts`.
- No `antelope.config.ts`: the DMS modules are ordinary npm dependencies, listed
  in the provider's `modules` map.
- Application code reaches the DMS through `runtime.use()`; `start/routes.ts`
  has an example on `GET /dms/info`.
- The dashboard (`@antelopejs/dms-frontend`) is built against the embedded DMS
  API and served on `:3001`.
- Loads `@antelopejs/dms` with `dms-api`, `dms-database`, `dms-automation` and
  `dms-media`, on MongoDB, `auth-jwt`, local file storage and nodemailer.

Prefer [`template-dms-demo`](https://github.com/AntelopeJS/template-dms-demo)
if you do not already have a Node.js app: there the `ajs` CLI owns the process
(**standalone** mode) and the dashboard runs with hot reload.

## Install

```bash
git clone https://github.com/AntelopeJS/template-dms-adonis.git my-app
cd my-app
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
```

You need Node.js 22.18 or later, pnpm, and a MongoDB server on
`mongodb://localhost:27017` (`MONGODB_URL` in `.env`).

## Quick start

Start AdonisJS and the embedded DMS:

```bash
pnpm dev
```

AdonisJS listens on `http://localhost:3333` and the DMS API on
`http://localhost:5010`. Check that the DMS answers through AdonisJS:

```bash
curl http://localhost:3333/dms/info
```

In a second terminal, while the backend runs, build and start the dashboard:

```bash
pnpm frontend:build
pnpm frontend:start
```

Open `http://localhost:3001`. A fresh database has no account, so the dashboard
opens the first-run wizard that creates the administrator; after that it shows
the sign-in page. Run `pnpm frontend:build` again after you add or remove a DMS
module.

`ajs dms dev` (hot reload) does not work in embedded mode: it needs a backend
started by `ajs project dev`. Replace the development secrets of `.env` before
you deploy.

## Documentation

- [Run the DMS inside AdonisJS](https://dms.antelopejs.com/docs/getting-started/adonisjs):
  set-up, configuration, the dashboard and the limitations of embedded mode.
- [Embedded runtime](https://framework.antelopejs.com/docs/guides/embedded-runtime):
  how `createRuntime` works, its lifecycle and `runtime.use()`.
- [Frontend CLI](https://dms.antelopejs.com/docs/frontend/cli/overview):
  `ajs dms build` and `ajs dms start`, and their environment variables.

## Compatibility

| Package                    | Version          |
| -------------------------- | ---------------- |
| `@adonisjs/core`           | `^6.18.0`        |
| `@antelopejs/core`         | `^1.15.2`        |
| `@antelopejs/dms`          | `>=0.9.2 <1.0.0` |
| `@antelopejs/dms-frontend` | `>=0.6.1 <0.7.0` |
| Node.js                    | 22.18 or later   |

`@antelopejs/dms` 0.9.2 requires `@antelopejs/core` 1.15.2 or later. Only
AdonisJS 6 is tested.

## AI coding agents

The [antelopejs plugin](https://github.com/AntelopeJS/agent-skills) syncs the
DMS agent skills into the project after `pnpm install`. This repository's
`.claude/settings.json` enables it in Claude Code; in Codex, run
`codex plugin marketplace add AntelopeJS/agent-skills` then
`codex plugin add antelopejs@antelopejs`. `AGENTS.md` holds the agent guidance
for this project. In embedded mode, add a module to the provider's `modules`
map, not with `ajs project modules add`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Before you open a pull request, run
`pnpm run checks` (the tests need MongoDB).

## License

This repository does not ship a license file yet.
