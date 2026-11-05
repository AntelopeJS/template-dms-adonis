---
covers:
  - demo/**
  - pnpm-workspace.yaml
  - scripts/sync-demo.sh
docs:
  - README.md
  - AGENTS.md
journeys:
  - demo-content
  - demo-sync
---

# Demo

The demo content of `template-dms-demo`, Helio and its home page, as the local AntelopeJS module in `demo/`, a workspace package that `pnpm install` builds to `demo/dist`.

## Sub-features

- `demo-content`: after `pnpm install`, `node ace serve` loads the demo module; `/dms/info` lists `template-dms-demo-frontend-vue`, the DMS API serves the `/home` page, and Helio's customer fixtures are in MongoDB.
- `demo-sync`: `pnpm demo:sync <checkout>` copies `src/`, `content/` and `frontend-vue/` of a template-dms-demo checkout into `demo/` and points the frontend module's `dev` and `build` scripts at the project root; a checkout holding the files `demo/` already has leaves `git status demo` empty.

## How to get to it (user POV)

- `pnpm dev`, sign in on the dashboard, open Home and Helio.
- `pnpm demo:sync ../template-dms-demo` from a clone of this repository.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" demo
```

## Gotchas

- `demo-sync` builds its source checkout from the scaffolded project's own `demo/`, because no step may reach GitHub; it proves the copy is exact and the script rewrite is stable, not that the upstream demo is unchanged.
