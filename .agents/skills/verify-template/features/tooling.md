---
covers:
  - oxlint.config.ts
  - oxfmt.config.ts
  - knip.config.ts
  - tsconfig.json
  - guardrails.suppressions.json
  - renovate.json
  - .editorconfig
  - .nvmrc
docs:
  - AGENTS.md
  - CONTRIBUTING.md
journeys:
  - lint-typecheck
  - lint-rejects
  - checks
---

# Tooling

The guardrail configuration the clone inherits: TypeScript, lint, format, knip, the suppression budget and Renovate.

## Sub-features

- `lint-typecheck`: `typecheck`, `lint`, `format:check` and `knip` pass.
- `lint-rejects`: a type error fails the typecheck and a `debugger` statement fails lint, so the configs are live.
- `checks`: `pnpm run checks` passes in a git repository holding the clone, with MongoDB for the tests.

## How to get to it (user POV)

- `pnpm run checks` before opening a pull request.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" tooling
```

## Gotchas

- `ajs project init` does not scaffold this template (it is not in the interfaces manifest, and init writes an `antelope.config.ts` and runs `npx tsc` that an AdonisJS application has no use for). The README tells the user to `git clone`, so every journey copies the working tree (tracked and untracked files) into a fresh folder, runs `pnpm install --frozen-lockfile` and writes `.env` the way the README says, pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
