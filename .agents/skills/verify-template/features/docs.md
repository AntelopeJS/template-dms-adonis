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

- Opening the README of a fresh clone.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" docs
```

## Gotchas

- `ajs project init` does not scaffold this template (it is not in the interfaces manifest, and init writes an `antelope.config.ts` and runs `npx tsc` that an AdonisJS application has no use for). The README tells the user to `git clone`, so every journey copies the working tree (tracked and untracked files) into a fresh folder, runs `pnpm install --frozen-lockfile` and writes `.env` the way the README says, pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
