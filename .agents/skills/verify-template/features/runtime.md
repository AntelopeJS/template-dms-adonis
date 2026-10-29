---
covers:
  - providers/**
  - start/env.ts
  - config/**
  - .env.example
docs:
  - README.md
journeys:
  - config-mapping
  - database-override
  - missing-env
  - mongo-unreachable
  - restart-persistence
---

# Runtime

The embedded DMS runtime and the `.env` that drives it: the provider wires each variable onto a module's config.

## Sub-features

- `config-mapping`: the `.env` copied from `.env.example`, with only `DMS_CLIENT_BASE_URL` changed: `/dms/info` reports the new base url, the only database the run creates is the literal `template_dms_adonis` the example names, and every DMS collection lands in it. This is the containment journey of the Data door.
- `database-override`: with another `MONGODB_DATABASE` every DMS collection lands there and the default database is never created.
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
