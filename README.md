# template-dms-adonis

A minimal template running the [AntelopeJS](https://antelopejs.com) DMS **inside an
AdonisJS application**. AdonisJS owns the process — its HTTP server, signals, logger
and configuration — and the DMS runs as a subsystem alongside it.

This is the inverse of [`template-dms-demo`](https://github.com/AntelopeJS/template-dms-demo), where the
AntelopeJS CLI (`ajs project run`) is the process owner and modules are declared in
`antelope.config.ts`. Here there is no `antelope.config.ts` at all: modules are
ordinary npm dependencies, and the module list lives in the service provider.

## How it works

`providers/antelope_provider.ts` creates the runtime and ties it to the AdonisJS
service-provider lifecycle:

| AdonisJS hook | Action |
| ------------- | ------ |
| `register()`  | `createRuntime({ ... })`, bound into the container |
| `start()`     | `runtime.start()` — boots the DMS before HTTP serving begins |
| `shutdown()`  | `runtime.stop()` — tears the DMS down with the app |

The runtime is a **guest**: it installs no `uncaughtException` / `unhandledRejection`
handlers, claims no `SIGINT` / `SIGTERM`, draws no spinners and does not touch the
global logger. All of that stays with AdonisJS.

Modules are resolved from this application's own `node_modules`, so nothing is
downloaded at boot and no `.antelope/cache` directory is created.

### Reaching the DMS from application code

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
`ANTELOPE_API_PORT`). Mounting it into the AdonisJS HTTP server is not supported
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
not include the dashboard frontend dependency or a `frontend:dev` script. Start
with `template-dms-demo` if your goal is the complete dashboard quickstart.

## Configuration

Everything is driven by `.env` (see `.env.example`) and mapped onto module config in
`providers/antelope_provider.ts`:

| Variable                   | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `MONGODB_URL`              | MongoDB connection string                |
| `MONGODB_DATABASE`         | Database name                            |
| `ANTELOPE_API_HOST` / `_PORT` | Where the DMS API server listens      |
| `ANTELOPE_API_BASE_URL`    | Public URL of that API server            |
| `ANTELOPE_CLIENT_BASE_URL` | DMS frontend origin, used for CORS       |
| `ANTELOPE_JWT_SECRET`      | Auth signing secret                      |

To add a DMS feature module (`@antelopejs/dms-api`, `@antelopejs/dms-database`,
`@antelopejs/dms-lang`, …), install it and add an entry to the `modules` map in
the provider, keyed by its package name. No other wiring is needed.

## Requirements

The embedded runtime shipped in `@antelopejs/core` 1.5.0, which is what this
template depends on. Earlier versions do not export `createRuntime`.
