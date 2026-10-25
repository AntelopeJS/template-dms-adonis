# AntelopeJS DMS inside AdonisJS

This AdonisJS application runs the AntelopeJS DMS as an embedded guest runtime:
there is no `antelope.config.ts`. `providers/antelope_provider.ts` creates the
runtime with `createRuntime` and lists the modules, which are ordinary npm
dependencies. Host code reaches the DMS through
`runtime.use('<interface package>[/subpath]')`, never by importing an
`@antelopejs/interface-*` package.

The DMS guidance ships as skills inside its packages, synced into the project
once `pnpm install` has run: Claude Code reads them from `.claude/skills/`,
Codex from `.agents/skills/`. When they seem missing:

- Claude Code: run `/antelopejs:sync-skills`; `/antelopejs:skills` lists what
  is synced. The antelopejs plugin syncs on session start and after installs,
  and `.claude/settings.json` offers to install it when you trust this folder.
- Codex: run `npx -y github:AntelopeJS/agent-skills sync --target codex` from
  the project root (`list` instead of `sync` shows what is synced), then
  restart Codex if a skill does not appear.

Start with the `dms` skill for the mental model and its routing, and follow
`dms-best-practices` when building pages and blocks. The DMS skills assume an
`ajs`-driven project when they talk about `antelope.config.ts` and dev servers:
here, configure modules in the provider and run the app with `pnpm dev`. The
dashboard is built and served with `pnpm frontend:build` then
`pnpm frontend:start` while `pnpm dev` runs; `ajs dms dev` does not work in
embedded mode.

## Checks

`pnpm run checks` runs typecheck, lint, format, knip, `pnpm test`, size,
ratchet and sync, and prints only what failed.

- `pnpm test` boots the whole application, so it needs MongoDB on
  `mongodb://localhost:27017`. It reads `.env.test` (`NODE_ENV=test`) and
  falls back to `.env` for keys `.env.test` lacks. CI has no `.env` while it
  runs the tests, so add every new key of `start/env.ts` to `.env.example` and
  `.env.test`.
- `checks` does not build or start the app. CI runs `pnpm build`, then boots
  `node ace serve` and queries `/dms/info` and the DMS API: see
  `.github/workflows/ci.yml`. Neither checks the dashboard
  (`pnpm frontend:build`).
- `guardrails.ratchet.json` records the lint findings the template already had;
  its numbers only go down. After you remove debt, run
  `pnpm run ratchet:update` and commit the lowered file. The pre-commit hook
  rejects new findings on the lines you add.
- The code style is AdonisJS's (no semicolons, single quotes, 100 columns), set
  in `oxfmt.config.ts`. `oxlint.config.ts` carries the `@adonisjs/eslint-config`
  rules oxlint has. `node ace make:*` output still needs `pnpm format`; delete
  the commented `HttpContext` import of a generated controller and give a
  generated test an assertion before you commit.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Lint with `oxlint` and format with `oxfmt`; both read the configs at the repository root. Fix every finding: no rule warns.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### What enforces what

| Rule                                                                           | Enforced by                               |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Formatting                                                                     | oxfmt                                     |
| Lint findings are errors; no rule warns                                        | oxlint preset                             |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                  |
| Every test asserts                                                             | `antelopejs/require-assertion`            |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`          |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`  |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test` |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`       |

<!-- antelopejs-guardrails:end -->
