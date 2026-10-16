# AntelopeJS DMS AdonisJS Template

<div align="center">
<a href="https://discord.gg/sjK28QHrA7"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord"></a>
<a href="https://dms.antelopejs.com/docs/getting-started/quickstart"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation"></a>
</div>

An AdonisJS application that runs the [AntelopeJS DMS](https://dms.antelopejs.com)
as an embedded subsystem. AdonisJS owns the process (its HTTP server, signals,
logger and configuration), and the DMS starts and stops with it.

This is the inverse of [`template-dms-demo`](https://github.com/AntelopeJS/template-dms-demo), where the
AntelopeJS CLI (`ajs project run`) is the process owner and modules are declared in
`antelope.config.ts`. Here there is no `antelope.config.ts` at all: modules are
ordinary npm dependencies, and the module list lives in the service provider.

## What you get

```
my-app/
├── providers/antelope_provider.ts  # creates the DMS runtime and lists its modules
├── start/routes.ts                 # GET / and GET /dms/info, read through runtime.use()
├── start/env.ts                    # validates the variables of .env
├── .env.example                    # MongoDB, DMS API and auth settings
├── app/, bin/, config/, tests/     # a standard AdonisJS application
└── package.json                    # the DMS modules are ordinary npm dependencies
```

The runtime loads `@antelopejs/dms` with the `dms-api`, `dms-database`,
`dms-automation` and `dms-media` feature modules, on MongoDB, `auth-jwt`,
local file storage and nodemailer.

### How it works

`providers/antelope_provider.ts` creates the runtime and ties it to the AdonisJS
service-provider lifecycle:

| AdonisJS hook | Action                                                       |
| ------------- | ------------------------------------------------------------ |
| `register()`  | `createRuntime({ ... })`, bound into the container           |
| `start()`     | `runtime.start()` — boots the DMS before HTTP serving begins |
| `shutdown()`  | `runtime.stop()` — tears the DMS down with the app           |

The runtime is a **guest**: it installs no `uncaughtException` / `unhandledRejection`
handlers, claims no `SIGINT` / `SIGTERM`, draws no spinners and does not touch the
global logger. All of that stays with AdonisJS.

Modules are resolved from this application's own `node_modules`, so nothing is
downloaded at boot and no `.antelope/cache` directory is created.

#### Reaching the DMS from application code

Host code never imports an `@antelopejs/interface-*` package directly — doing so
would create a second, unattached copy of the interface. Instead it goes through the
runtime handle, which resolves the runtime's own provider-bound copy:

```ts
const { GetClientBaseUrl } = runtime.use<DmsClientBaseUrl>(
  '@antelopejs/interface-dms/client-base-url'
)
```

The request is an interface package name (or one of its subpaths), never the
runtime package: `@antelopejs/dms` implements `@antelopejs/interface-dms`, and the
runtime hands back its own bound copy of that interface.

`start/routes.ts` contains the single example: an ordinary AdonisJS route on the
Adonis port (`:3333`) that reads DMS state through that handle.

```
GET /          → runtime status and the loaded module list
GET /dms/info  → DMS client base URL and frontend modules, read through runtime.use()
```

The DMS's own API server is separate and listens on `:5010` (see
`DMS_API_PORT`). Mounting it into the AdonisJS HTTP server is not supported
today; the two listeners coexist.

## Prerequisites

- Node.js 22 and pnpm
- A running MongoDB instance (`mongodb://localhost:27017` by default)

## Getting started

```bash
git clone https://github.com/AntelopeJS/template-dms-adonis.git my-app
cd my-app
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
pnpm dev
```

Use a disposable `template_dms_adonis` MongoDB database and replace development
secrets before deploying.

Then:

```bash
curl http://localhost:3333/dms/info
```

This checks the embedded backend, not a rendered dashboard. The template does
not include the dashboard frontend loader (`@antelopejs/dms-frontend`, run with
`ajs dms dev`) or a `frontend:dev` script. Start with `template-dms-demo` if
your goal is the complete dashboard quickstart.

If you point the loader at this backend yourself, note that `ajs dms dev`
listens on `127.0.0.1` only; run it with `HOST=0.0.0.0` to reach the dashboard
from another machine (a container, a VM). The dashboard reaches the backend
through the loader's proxy, which forwards only the prefixes declared to it:
the DMS declares `/api/**` and `/dms/**`, and a module serving anything else to
the browser declares it with `backendProxies`.

## Configuration

Everything is driven by `.env` (see `.env.example`) and mapped onto module config in
`providers/antelope_provider.ts`:

| Variable                 | Purpose                            |
| ------------------------ | ---------------------------------- |
| `MONGODB_URL`            | MongoDB connection string          |
| `MONGODB_DATABASE`       | Database name                      |
| `DMS_API_HOST` / `_PORT` | Where the DMS API server listens   |
| `DMS_API_BASE_URL`       | Public URL of that API server      |
| `DMS_CLIENT_BASE_URL`    | DMS frontend origin, used for CORS |
| `DMS_JWT_SECRET`         | Auth signing secret                |

To add a DMS feature module (`@antelopejs/dms-api`, `@antelopejs/dms-database`,
`@antelopejs/dms-lang`, …), install it and add an entry to the `modules` map in
the provider, keyed by its package name. No other wiring is needed.

## Compatibility

The embedded runtime shipped in `@antelopejs/core` 1.5.0; earlier versions do
not export `createRuntime`. This template depends on `@antelopejs/core` `^1.13.4` and `@antelopejs/dms` `>=0.9.0 <1.0.0`.

## AI coding agents

The DMS ships its own agent skills (pages and blocks, auth and permissions,
module authoring, best practices). The
[antelopejs plugin](https://github.com/AntelopeJS/agent-skills) syncs them into
the project after `pnpm install`. Start with the `dms` skill. `AGENTS.md`
(which `CLAUDE.md` imports) holds the agent guidance for this project.

### Claude Code

This repository's `.claude/settings.json` registers the plugin: open the
project in Claude Code, accept the folder trust dialog, and the plugin is
enabled. It syncs the skills into `.claude/skills/`, and `/antelopejs:skills`
lists them. To install it by hand instead:

```bash
claude plugin marketplace add AntelopeJS/agent-skills
claude plugin install antelopejs@antelopejs
```

### Codex

Install the plugin from your shell (or from `/plugins` in Codex once the
marketplace is added):

```bash
codex plugin marketplace add AntelopeJS/agent-skills
codex plugin add antelopejs@antelopejs
```

Sync the skills into `.agents/skills/` from the project root, and again after
installing or upgrading packages:

```bash
npx -y github:AntelopeJS/agent-skills sync --target codex
```

## Documentation

- [Quickstart](https://dms.antelopejs.com/docs/getting-started/quickstart):
  how this template compares with `template-dms-demo`.
- [Project setup](https://dms.antelopejs.com/docs/building/project-setup): the
  modules a DMS project loads and their configuration.
- [AntelopeJS framework](https://framework.antelopejs.com/docs/get-started/introduction):
  modules, interfaces and the core that `createRuntime` comes from.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Before you open a pull request, run
`pnpm lint`, `pnpm typecheck` and `pnpm test`.

## License

This repository does not ship a license file yet.
