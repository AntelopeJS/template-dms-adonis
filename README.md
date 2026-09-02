# template-cms-adonis

A minimal template running the [AntelopeJS](https://antelopejs.com) CMS **inside an
AdonisJS application**. AdonisJS owns the process — its HTTP server, signals, logger
and configuration — and the CMS runs as a subsystem alongside it.

This is the inverse of [`template-cms-demo`](../template-cms-demo), where the
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

- Node.js 20+
- A running MongoDB instance (`mongodb://localhost:27017` by default)
- Access to the private registry (`.npmrc` points `@antelopejs-private` at
  `https://npm.antelopejs.cloud/`)

## Getting started

```bash
pnpm install
cp .env.example .env    # then set APP_KEY (node ace generate:key)
pnpm dev
```

Then:

```bash
curl http://localhost:3333/cms/info
```

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

## Temporary local patches

`patches/` contains two patches applied through `pnpm-workspace.yaml`:

- `@antelopejs/data-api@1.1.1`
- `@antelopejs/database-decorators@1.1.1`

Both modules declare `^0.0.3` for their `@antelopejs/interface-*` dependencies.
Under pre-1.0 semver a caret range does not widen past the patch version, so
`^0.0.3` cannot be satisfied by the current canonical `@antelopejs/interface-core`
(0.0.12) and startup fails version validation. The patches only widen those ranges
to the `>=x.y.z <1.0.0` policy the other AntelopeJS modules already use; no code is
changed.

This is **not specific to running embedded** — the same failure occurs under
`ajs project run` with the same module versions. Delete `patches/`, remove the
`patchedDependencies` block from `pnpm-workspace.yaml`, and reinstall once both
modules are republished with corrected ranges.

## Requirements

The embedded runtime shipped in `@antelopejs/core` 1.5.0, which is what this
template depends on. Earlier versions do not export `createRuntime`.
