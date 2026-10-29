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
  - missing-env
  - mongo-unreachable
  - restart-persistence
---

# Runtime

The embedded DMS runtime and the `.env` that drives it: the provider wires each variable onto a module's config.

## Sub-features

- `config-mapping`: with another `MONGODB_DATABASE` and `DMS_CLIENT_BASE_URL`, `/dms/info` reports the new base url, every DMS collection lands in the named database, and the default database is never created. This is the containment journey of the Data door.
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

- `ajs project init` does not scaffold this template (it is not in the interfaces manifest, and init writes an `antelope.config.ts` and runs `npx tsc` that an AdonisJS application has no use for). The README tells the user to `git clone`, so every journey copies the working tree (tracked and untracked files) into a fresh folder, runs `pnpm install --frozen-lockfile` and writes `.env` the way the README says, pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
