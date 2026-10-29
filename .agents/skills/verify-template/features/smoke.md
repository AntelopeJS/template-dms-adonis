---
covers:
docs:
  - README.md
journeys:
  - serve-structure
---

# Smoke

The fixed journey every verdict runs, whatever the diff touches: scaffold the template with `ajs project init`, install it, boot `node ace serve` against a MongoDB container, read `/` and `/dms/info`, check MongoDB, stop.

## Sub-features

- `serve-structure`: as in [routes](routes.md).

## How to get to it (user POV)

- `ajs project init my-app --template "DMS Adonis"`, `cp .env.example .env`, `node ace generate:key`, `pnpm dev`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" smoke
```

## Gotchas

- The smoke feature covers no glob, so it never marks a file as mapped.
- The dashboard (`pnpm frontend:build`, `pnpm frontend:start`) is not driven: it needs the DMS frontend build, which is slow, and the README itself says the template does not ship it as part of the backend quickstart.
