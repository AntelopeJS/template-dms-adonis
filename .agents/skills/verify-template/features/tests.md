---
covers:
  - tests/**
  - bin/test.ts
  - .env.test
docs:
  - README.md
  - AGENTS.md
journeys:
  - test-suite
  - test-fails
---

# Tests

`pnpm test` boots the whole application against MongoDB (`.env.test`) and runs the specs under `tests/`.

## Sub-features

- `test-suite`: both specs run and pass.
- `test-fails`: a failing spec added to the project makes `pnpm test` fail and names it.

## How to get to it (user POV)

- `pnpm test` with MongoDB on `localhost:27017` (the journeys point `.env.test` at their own container).

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" tests
```

## Gotchas

- `ajs project init` does not scaffold this template (it is not in the interfaces manifest, and init writes an `antelope.config.ts` and runs `npx tsc` that an AdonisJS application has no use for). The README tells the user to `git clone`, so every journey copies the working tree (tracked and untracked files) into a fresh folder, runs `pnpm install --frozen-lockfile` and writes `.env` the way the README says, pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
