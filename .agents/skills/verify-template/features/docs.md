---
covers:
  - README.md
  - CONTRIBUTING.md
  - AGENTS.md
  - CLAUDE.md
docs:
  - README.md
journeys:
  - docs-commands
---

# Docs

The pages the user reads first.

## Sub-features

- `docs-commands`: every `pnpm` command the README names exists as a script, the documented scripts are named, its variables are in `.env.example` and `start/env.ts`, the `curl` route is in `start/routes.ts` on the `.env.example` port, and its compatibility table matches the ranges of `package.json`.

## How to get to it (user POV)

- Opening the README of a scaffolded project.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" docs
```

## Gotchas

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
