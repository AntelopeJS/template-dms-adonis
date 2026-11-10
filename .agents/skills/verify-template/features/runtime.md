---
covers:
  - providers/**
  - start/env.ts
  - config/**
  - .env.example
  - antelope.config.ts
docs:
  - README.md
journeys:
  - config-mapping
  - database-override
  - first-run-setup-token
  - missing-env
  - mongo-unreachable
  - restart-persistence
---

# Runtime

The embedded DMS runtime and the `.env` that drives it: the provider wires each variable onto a module's config.

## Sub-features

- `config-mapping`: the `.env` copied from `.env.example`, with only `DMS_CLIENT_BASE_URL` changed: `/dms/info` reports the new base url, the only database the run creates is the literal `template_dms_adonis` the example names, and every DMS collection lands in it.
- `database-override`: with another `MONGODB_DATABASE` every DMS collection lands there and the default database is never created.
- `first-run-setup-token`: on an empty database, with the `.env` copied from `.env.example` (`DMS_SETUP_TOKEN` empty), the server log prints `No owner exists yet. To create it, open http://localhost:3001/onboarding?token=<generated token>`. The journey then does what the wizard at that address does: `POST /api/onboarding/register` on the DMS API with another token answers 403, with the printed token answers 200, `GET /api/onboarding/informations` turns `has_onboarded` to true, and one owner exists in `dms-core__users`. Opening the address in the dashboard is the `dashboard` journey of `build`.
- `missing-env`: without `.env` the server exits non-zero naming `APP_KEY` and `MONGODB_URL`.
- `mongo-unreachable`: with nothing at `MONGODB_URL` the runtime fails to construct its modules after about 30 seconds, the process exits non-zero and no server starts.
- `restart-persistence`: Ctrl+C closes every MongoDB connection (`serverStatus().connections` returns to the baseline) and a second start finds the data of the first (a marker document) and loses no collection.

## How to get to it (user POV)

- `cp .env.example .env`, `node ace generate:key`, edit the variables.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" runtime
```

## Gotchas

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
