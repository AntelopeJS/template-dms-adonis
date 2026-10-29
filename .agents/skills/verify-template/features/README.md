# Feature map

One file per feature. `covers:` lists the source globs it owns, `docs:` the pages a verdict judges, `journeys:` the journeys it runs, and `seeded-breaks/<feature>.patch` the break its journeys must catch. `pnpm exec antelopejs-verify map` checks that every user-facing file is covered: in a template that is every file a clone carries.

| Feature | What the user does | Journeys |
|---|---|---|
| [routes](routes.md) | Starts the server and calls its routes. | serve-structure, not-found, serve-hmr |
| [runtime](runtime.md) | Configures the embedded DMS runtime through `.env`. | config-mapping, missing-env, mongo-unreachable, restart-persistence |
| [tests](tests.md) | Runs `pnpm test`. | test-suite, test-fails |
| [tooling](tooling.md) | Runs typecheck, lint, knip and `pnpm run checks`. | lint-typecheck, lint-rejects, checks |
| [build](build.md) | Runs `pnpm build`. | build-output |
| [docs](docs.md) | Follows the README. | docs-commands |
| [git](git.md) | Commits in a clone. | gitignore |
| [smoke](smoke.md) | The fixed journey every verdict runs: install, serve, read the routes, stop. | serve-structure |
