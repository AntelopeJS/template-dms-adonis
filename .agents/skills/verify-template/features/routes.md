---
covers:
  - start/routes.ts
  - start/kernel.ts
  - app/**
  - bin/server.ts
  - bin/console.ts
  - ace.js
docs:
  - README.md
journeys:
  - serve-structure
  - not-found
  - serve-hmr
---

# Routes

The application's HTTP surface: the AdonisJS server on `:3333` with the two example routes.

## Sub-features

- `serve-structure`: `node ace serve` boots; `GET /` answers `{ host: 'adonisjs', dms: { running: true, modules } }` with the six provider modules; `GET /dms/info` answers `servedBy`, the client base url and the dashboard module names; MongoDB holds the DMS collections; Ctrl+C ends the server.
- `not-found`: an unknown route and a wrong method answer 404.
- `serve-hmr`: `node ace serve --hmr` (what `pnpm dev` runs) answers the same routes, and the port refuses after Ctrl+C.

## How to get to it (user POV)

- `pnpm dev`, then `curl http://localhost:3333/dms/info`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" routes
```

## Gotchas

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
