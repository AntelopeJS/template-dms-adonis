# AntelopeJS DMS inside AdonisJS

This AdonisJS application runs the AntelopeJS DMS as an embedded guest runtime:
`antelope.config.ts` is read only by `ajs dms build` and `ajs dms start`, and lists
the installed dependencies that ship a dashboard frontend, plus the demo module in `demo/`.
It gives each module whose frontend reads its config the public options of
`providers/public_module_options.ts`, as the provider does, so the dashboard and the runtime
agree on the homepage, URLs and keys. `providers/antelope_provider.ts` creates the
runtime with `createRuntime` and lists the modules: the DMS modules are ordinary npm
dependencies, and `template-dms-demo` is the local module in `demo/`. Host code reaches the
DMS through `runtime.use('<interface package>[/subpath]')`, never by importing an
`@antelopejs/interface-*` package.

`demo/` holds the pages, seed data and frontend of the demo, Helio: `demo/src` is an
AntelopeJS module (its pages, tables, fixtures and controllers), `demo/content` the Markdown
its home page reads, `demo/frontend-vue` its frontend module and translations. It is a
workspace package with its own TypeScript, oxlint, oxfmt and knip configs, in the demo's
style (double quotes, semicolons), built to `demo/dist` by `pnpm install`, `pnpm dev` and `pnpm build`.
The root scripts run its checks after the application's.

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
suppressions and sync, and prints only what failed.

- `pnpm test` boots the whole application, so it needs MongoDB on
  `mongodb://localhost:27017`. It reads `.env.test` (`NODE_ENV=test`) and
  falls back to `.env` for keys `.env.test` lacks. CI has no `.env` while it
  runs the tests, so add every new key of `start/env.ts` to `.env.example` and
  `.env.test`.
- `checks` does not build or start the app. CI runs `pnpm build`, then boots
  `node ace serve` and queries `/dms/info` and the DMS API: see
  `.github/workflows/ci.yml`. Neither checks the dashboard
  (`pnpm frontend:build`).
- `guardrails.suppressions.json` caps the lint directives, `@ts-expect-error`,
  `@ts-ignore` and `SAFETY:` comments; its numbers only go down. After you
  remove suppressions, run `pnpm run suppressions:update` and commit the
  lowered file. `pnpm run checks` fails when a count rises above its ceiling.
- The code style is AdonisJS's (no semicolons, single quotes, 100 columns), set
  in `oxfmt.config.ts`. `oxlint.config.ts` carries the `@adonisjs/eslint-config`
  rules oxlint has. `node ace make:*` output still needs `pnpm format`; delete
  the commented `HttpContext` import of a generated controller and give a
  generated test an assertion before you commit.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

CI runs `pnpm run checks` in full on every pull request and reports what failed. The commit hook formats and lints the staged files. Locally, check only what you touched, one test file and not the suite, as the [`verify-template-dms-adonis`](.agents/skills/verify-template-dms-adonis/SKILL.md) skill says.

### Comments

Say it in code: a constraint in a type, a lint rule or a test, a public item's contract in TSDoc. Other comments are lint directives naming their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, and license or tool directives. A reason states what the code does now.

### Tests

Each test names the wrong implementation it fails on, or is deleted. Drive behaviour through the public interface. An invariant over many files is a lint rule.

### Review

No tool checks these:

- A type guard checks the nested elements and values it claims.
- A no-upward import rule rejects same-tier peers; probe it with an import.
- A finding only an evasion or a patched internal can trigger goes under Attention and never blocks.

### Suppressions

`guardrails.suppressions.json` caps lint directives, `@ts-expect-error`, `SAFETY:` comments and rules a lint config turns off. Over a cap, fix the code or remove another suppression of that kind; only the operator raises a number. After removing suppressions, run `pnpm run suppressions:update` and commit the file.

<!-- antelopejs-guardrails:end -->
