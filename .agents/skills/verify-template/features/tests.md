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

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
