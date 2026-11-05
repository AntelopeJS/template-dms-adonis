---
covers:
  - package.json
  - pnpm-lock.yaml
  - adonisrc.ts
  - antelope.config.ts
docs:
  - README.md
journeys:
  - build-output
  - dashboard
---

# Build

The scripts, the dependency set, the AdonisJS manifest, and `antelope.config.ts`, which tells the dashboard build which modules ship a frontend.

## Sub-features

- `build-output`: `pnpm build` writes `build/bin/server.js`, `build/ace.js`, `build/package.json`, the provider and the routes.
- `dashboard`: with the backend running and `DMS_SETUP_TOKEN` set, `pnpm frontend:build` then `pnpm frontend:start -p <port>` serve the first-run wizard of an empty database at `/onboarding?token=<DMS_SETUP_TOKEN>`, with its translated title and first step, and the page carries the DMS options the provider sets: the `/modules` homepage and the `DMS_API_BASE_URL` of `.env`. An empty `modules` map in `antelope.config.ts` builds a dashboard with no DMS frontend module, whose wizard has an untranslated title and no content.

## How to get to it (user POV)

- `pnpm build`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" build
```

## Gotchas

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
