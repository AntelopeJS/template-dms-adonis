---
name: verify-template-dms-adonis
description: How to check a change in template-dms-adonis before you push it, scoped to what you touched. The command per kind of change (AdonisJS app, demo module, demo frontend, template journeys, CI), the MongoDB a test needs, the worker cap, and what CI and the merge queue run instead of you. Use after you edit code, tests, configs or docs here, before you commit or push.
---

# Verify a change in template-dms-adonis

CI runs every check on every pull request, and the merge queue runs them again on the merged result. You check only what you changed. This repository holds three packages with their own configs: the AdonisJS app at the root (AdonisJS style), the demo module in `demo/` and its frontend in `demo/frontend-vue/` (demo style). Run each command from the directory its row names.

## Setup

Once per checkout: `pnpm install`. It needs Node 24 (`.nvmrc`) and pnpm 10 (`packageManager`), and it builds `demo/dist`. Docker runs the MongoDB of the template journeys.

On a host where `~/.cache` is writable by its group, SWC refuses to load and `node ace` fails with `ERR_SWC_NATIVE_CACHE`. Set `SWC_NATIVE_BINDING_CACHE` to a directory only you can write, such as `mkdir -p -m 700 "$TMPDIR/swc"`.

## What to run for your change

| You changed | Run |
| --- | --- |
| A root file (`app/`, `providers/`, `start/`, `config/`, `tests/`, `*.ts`) | `pnpm exec oxlint <files>` and `pnpm exec oxfmt --check <files>`. The root configs ignore `demo/**`. |
| A file in `demo/` outside `frontend-vue/` | From `demo/`: `pnpm exec oxlint --type-aware <files>` and `pnpm exec oxfmt --check <files>`. |
| A file in `demo/frontend-vue/` | From `demo/frontend-vue/`: `pnpm exec eslint <files>`, and from `demo/`: `pnpm exec oxfmt --check <files>`. |
| A type, a signature or an export | `pnpm run typecheck`. It checks the app and the demo in a few seconds. |
| App behaviour | One Japa file under a MongoDB lease. See [Services](#services). |
| Demo module behaviour | `pnpm --dir demo run build`, then `node --test --test-concurrency=4 demo/dist/<path>.test.js`. |
| Demo frontend behaviour | From `demo/frontend-vue/`: `pnpm exec vitest run tests/<file>.test.ts --maxWorkers=4`. |
| A template journey (`.github/scripts/template/`) | `pnpm exec tsc -p .github/scripts/template`, then the one journey file: `node --test --test-concurrency=1 --test-timeout=1200000 --test-global-setup=.github/scripts/template/setup.ts .github/scripts/template/<file>.test.ts`. Each journey scaffolds a project and starts its own `mongo:7` container on a free port, so it takes about a minute. |
| `demo/src`, `demo/content` or `demo/frontend-vue` copied from template-dms-demo | Nothing here. Change template-dms-demo, then run `pnpm demo:sync <template-dms-demo checkout>`. The `demo-drift` job fails on a hand edit. |
| A lint directive, `@ts-expect-error` or `SAFETY:` comment | `pnpm run suppressions`. After you remove one, run `pnpm run suppressions:update` and commit `guardrails.suppressions.json`. |
| `.github/workflows/ci.yml`, `lefthook.yml`, the AGENTS.md Guardrails block, `.agents/skills/{verify-changes,technical-writing,unslop}` | Nothing by hand. `antelopejs-sync` writes them: bump `@antelopejs/tooling-configs`, run `pnpm run sync`, then `pnpm run sync:check`. |
| A new key of `start/env.ts` | Add it to `.env.example` and `.env.test`: CI has no `.env` while it tests. |

Never run `pnpm test` or `pnpm run checks`: they run every suite. Run at most 4 test workers, since other agents share the machine.

## Services

The app tests need MongoDB. Run one file through a lease, which starts a mongod for this worktree on its own port. The lease sets `MONGO_URL` and `MONGO_DATABASE`, and the app reads `MONGODB_URL` and `MONGODB_DATABASE`, so pass them on:

```sh
pnpm exec antelopejs-lease run -- sh -c 'MONGODB_URL="$MONGO_URL" MONGODB_DATABASE="$MONGO_DATABASE" node ace test --files tests/unit/<file>.spec.ts'
pnpm exec antelopejs-lease down --stop
```

The demo module tests, the frontend tests and the typecheck need no service. The journeys start and remove their own containers. Stop only what you started.

## Left to CI

The workflow `ci.yml` runs these. Read their results on your pull request, and rerun only the scoped command of a failing one to reproduce it:

- `ci / Node .nvmrc`: `pnpm run checks` (typecheck, lint, format, knip, size, suppressions, sync) and the README check, on Linux.
- `ci / Test .nvmrc`: `pnpm test`, every app, demo and frontend test, beside the MongoDB of `.github/compose.yml`. The queue retries a failed test once.
- `ci / Extra .nvmrc 1/3` to `3/3`: every template journey on Linux, outside the fast tier of a pull request. The last shard runs `pnpm build`, starts `node ace serve` and queries `/dms/info`, `/` and the DMS API on `:5010`.
- `demo-drift`: `demo/` against template-dms-demo `main`.
- The nightly tier: the Windows jobs and `ci / Stress`.
- `ci / checks` fails when a job of `ci` failed, and `verdict` when `ci` or `demo-drift` failed.

No CI job builds the dashboard (`pnpm frontend:build`). A change to the dashboard modules of `antelope.config.ts` is checked by running `pnpm frontend:build` once.

## Done

Your change is checked when every row its diff touches passed, with the command and its output shown. A row that cannot run says why, in your report.
