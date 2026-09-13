# template-cms-adonis

A minimal template running the [AntelopeJS](https://antelopejs.com) CMS **inside an
AdonisJS application**. AdonisJS owns the process — its HTTP server, signals, logger
and configuration — and the CMS runs as a subsystem alongside it.

This is the inverse of [`template-cms-demo`](https://github.com/AntelopeJS/template-cms-demo), where the
AntelopeJS CLI (`ajs project run`) is the process owner and modules are declared in
`antelope.config.ts`. Here there is no `antelope.config.ts` at all: modules are
ordinary npm dependencies, and the module list lives in the service provider.

## How it works

`providers/antelope_provider.ts` creates the runtime and ties it to the AdonisJS
service-provider lifecycle:

| AdonisJS hook | Action |
| ------------- | ------ |
| `register()`  | `createRuntime({ ... })`, bound into the container |
| `start()`     | `runtime.start()` — boots the CMS before HTTP serving begins |
| `shutdown()`  | `runtime.stop()` — tears the CMS down with the app |

The runtime is a **guest**: it installs no `uncaughtException` / `unhandledRejection`
handlers, claims no `SIGINT` / `SIGTERM`, draws no spinners and does not touch the
global logger. All of that stays with AdonisJS.

Modules are resolved from this application's own `node_modules`, so nothing is
downloaded at boot and no `.antelope/cache` directory is created.

### Reaching the CMS from application code

Host code never imports an `@antelopejs/interface-*` package directly — doing so
would create a second, unattached copy of the interface. Instead it goes through the
runtime handle, which resolves the runtime's own provider-bound copy:

```ts
const cms = runtime.use<CmsInterface>('@antelopejs-private/cms')
```

`start/routes.ts` contains the single example: an ordinary AdonisJS route on the
Adonis port (`:3333`) that reads CMS configuration through that handle.

```
GET /          → runtime status and the loaded module list
GET /cms/info  → CMS configuration, read through runtime.use()
```

The CMS's own API server is separate and listens on `:5010` (see
`ANTELOPE_API_PORT`). Mounting it into the AdonisJS HTTP server is not supported
today; the two listeners coexist.

## Prerequisites

- Node.js 22 and pnpm
- A running MongoDB instance (`mongodb://localhost:27017` by default)
- Access to the private registry (`.npmrc` points `@antelopejs-private` at
  `https://npm.antelopejs.cloud/`)

## Getting started

```bash
git clone https://github.com/AntelopeJS/template-cms-adonis.git my-app
cd my-app
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
pnpm dev
```

Configure the registry credential in your user-level `~/.npmrc`, not in a
committed project file. Keep the current `@antelopejs-private/*` package names;
the planned interface extraction does not make public replacements available.
Use a disposable `template_cms_adonis` MongoDB database and replace development
secrets before deploying.

Then:

```bash
curl http://localhost:3333/cms/info
```

This checks the embedded backend, not a rendered dashboard. The template does
not include the `acms` frontend dependency or a `frontend:dev` script. Start
with `template-cms-demo` if your goal is the complete dashboard quickstart.

## Configuration

Everything is driven by `.env` (see `.env.example`) and mapped onto module config in
`providers/antelope_provider.ts`:

| Variable                   | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `MONGODB_URL`              | MongoDB connection string                |
| `MONGODB_DATABASE`         | Database name                            |
| `ANTELOPE_API_HOST` / `_PORT` | Where the CMS API server listens      |
| `ANTELOPE_API_BASE_URL`    | Public URL of that API server            |
| `ANTELOPE_CLIENT_BASE_URL` | CMS frontend origin, used for CORS       |
| `ANTELOPE_JWT_SECRET`      | Auth signing secret                      |

To add a CMS feature module (`cms-api`, `cms-database`, `cms-lang`, …), install it
and add an entry to the `modules` map in the provider. No other wiring is needed.

## Requirements

The embedded runtime shipped in `@antelopejs/core` 1.5.0, which is what this
template depends on. Earlier versions do not export `createRuntime`.
