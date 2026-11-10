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

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, suppressions, and sync, and prints only what failed. The change is done when it prints no failure.

### While you work

`pnpm run checks` runs every step, so run it once, at the end. While you iterate, run only the check that covers what you changed:

- `pnpm run typecheck` after you change types or signatures.
- `pnpm exec oxlint <files>` and `pnpm exec oxfmt <files>` on the files you changed.
- Run one test file instead of the whole suite. In a module that tests with `ajs module test`, run `pnpm run build`, then `pnpm exec ajs module test . -f dist/<path>.test.js`. Repeat `-f` for more files.

Prove a change works with the verification skill in [`.agents/skills/verify-template/SKILL.md`](.agents/skills/verify-template/SKILL.md) before you call it done.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

Before suppressing a type rule, try inference or a type derived from its owner with `Parameters`, `ReturnType`, or indexed access. A private alias can still appear in a published declaration. Keep a suppression only after checking the published contract and the unchecked boundary it protects.

Check each directive reason against the current line and its callers. Returning a value is not the same as awaiting and discarding it. A reason must describe what the code does now.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Cleanup proof

A behaviour-preserving cleanup PR shows `antelopejs-api-diff <base-ref>` passing. Published declarations, built runtime exports and the names and signatures a DMS frontend module auto-imports stay unchanged; pass `--allow-added <glob>` (repeatable, e.g. `'**/internal/**'`) to let added entries under that glob pass when their module is `@internal`, and copy its "Added (allowed)" list. Every export under a directory that `dms.frontend.build.ts` auto-imports is published, `@internal` or not; a helper that must stay private goes under `app/build/`. A comment-only PR shows `antelopejs-comment-proof <base-ref>` passing instead of a verifier. Both compare committed HEAD.

Copy the proof's whole output into the PR body, down to its closing `<!-- antelopejs-proof ... -->` line, which stamps the command, base, committed head and a digest. Never type counts by hand. List the lint findings a PR leaves in place by pasting the block `antelopejs-body-check --findings` prints and replacing each `<why>`. `antelopejs-body-check <body.md>` fails an edited or stale proof block, proof output outside one, and a findings line that is not a live diagnostic at HEAD; counts in prose are not checked, so leave them out. The table counts a lint directive once per rule it names, inline directives included.

Pass `--probe <file.cjs>` to api-diff when changing receivers, positional calls, or modules that no published entry reaches. The same captured script runs against both worktree roots, supplied as `argv[2]`, and prints JSON observations. Matching metadata alone does not prove those behaviours.

An entry-only rule exempts only its own module. Add a second module entry rather than exempting another importer. A no-upward rule must reject peers in the same tier as well as higher tiers. Probe the rank decision with an import, not just a reading of the configuration.

Moving a method body into a function keeps how it is called: the same receiver, argument count, read order and laziness.

Verify a boundary against the imports a developer or agent would plausibly write: static and dynamic imports, re-exports, Vue `src`, CSS `@import`, and worker or child-process entries in normally named files. A construction only an evasion would write, an edit to resolution configuration (`package.json` `browser`, `exports`, `main` or `imports`, bundler aliases, tsconfig `paths`), and a difference observable only by patching private fields or internal methods go under Attention and never block. Public API and ordinary subclass behaviour stay part of the contract.

### Suppression budget

`guardrails.suppressions.json` caps the suppressions in authored code, the repository's own files under `.agents/`, `.claude/` and the other agent directories included (`agentFiles`; only what `antelopejs-sync` writes there is skipped): lint directives per rule they name (`*` for none), `@ts-expect-error`, `@ts-ignore` and `SAFETY:` comments, and under `config` each rule a lint config (`oxlint.config.*`, `.oxlintrc.json`, `eslint.config.*`) switches off or to a warning, keyed by rule and `files` glob anchored at the config's directory, so widening or moving a scope is a new ceiling of 0, while narrowing one takes over the room it gives up. Switching a rule off in a config is a suppression too: fix the code its rule reports instead. A suppression over its ceiling fails: fix the code, or remove another suppression of the same kind. A rule that keeps needing suppressions should be changed in the preset. Never raise or remove a number in that file: the check fails a ceiling higher than on the pull request base, and only the operator approves a raise. A directive disabling `anti-slop/require-safety-comment-for-type-assertion` is burn-down debt: remove the assertion, or, where it holds, replace the directive with `SAFETY: <why it holds>`, which takes over its room without a raise. After you remove suppressions, run `pnpm run suppressions:update` and commit the lowered file.

### What enforces what

| Rule                                                                           | Enforced by                                         |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Formatting                                                                     | oxfmt                                               |
| Lint findings are errors; no rule warns                                        | oxlint preset                                       |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                            |
| Every test asserts                                                             | `antelopejs/require-assertion`                      |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`                    |
| Tests import the code under test from local source, not their own package name | `antelopejs/no-self-import-in-tests`                |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`            |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test`           |
| String-keyed object tables are read through own keys only                      | `antelopejs/no-inherited-key-lookup`                |
| A type guard checks each member it narrows to; keys with `Object.hasOwn`       | `antelopejs/no-presence-only-type-guard`            |
| A type guard checks the nested elements and values it claims                   | review; no tool                                     |
| A startup read does not decide an insert another replica can race              | `antelopejs/no-read-then-insert`                    |
| `Object.assign` writes no `unknown`, `any` or mistyped value over a field      | `antelopejs/no-unsafe-object-assign`                |
| Every file type-aware lint reads is listed by a tsconfig                       | `antelopejs/require-tsconfig-include`               |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`                 |
| Cleanup preserves declarations, runtime exports and DMS auto-imports           | `antelopejs-api-diff <base-ref>`                    |
| Comment-only changes preserve JavaScript emit                                  | `antelopejs-comment-proof <base-ref>`               |
| PR-body proof tables are copied unedited from the current head                 | `antelopejs-body-check <body.md>`                   |
| PR-body findings-left lines are live diagnostics at HEAD                       | `antelopejs-body-check <body.md>`                   |
| Receiver, positional and unpublished-module behaviour                          | `antelopejs-api-diff <base-ref> --probe <file.cjs>` |
| Directive and `SAFETY:` reasons are true of the code                           | review; no tool                                     |
| Evasion-only and patched-internal findings go under Attention                  | review; no tool                                     |
| No-upward rules reject same-tier peers                                         | review and import probes                            |
| No `@ts-ignore`                                                                | `typescript/ban-ts-comment`                         |
| No once-used type parameter standing in for `unknown`                          | `typescript/no-unnecessary-type-parameters`         |
| No `any` passed, assigned or returned where a type is declared                 | `typescript/no-unsafe-{argument,assignment,return}` |
| Files ≤ 20,000 bytes, tests and agent files included                           | `antelopejs-check-size` (pre-commit)                |
| Suppressions stay within `guardrails.suppressions.json`                        | `antelopejs-suppressions` (pre-commit, checks)      |
| No lint config switches off a rule to stay under the budget                    | `antelopejs-suppressions` (pre-commit, checks)      |
| No added directive disables the `SAFETY:`, comment or test rules               | `antelopejs-suppressions` (pre-commit, checks)      |
| An added suppression gives a specific reason                                   | `antelopejs-suppressions` (pre-commit, checks)      |
| A directive in a file a change touches suppresses something and gives a reason | `antelopejs-suppressions` (pre-commit, checks)      |
| A block disable is closed in its file                                          | `antelopejs-suppressions` (pre-commit, checks)      |
| Types check                                                                    | `tsc` (pre-push)                                    |
| No dead files, exports, or dependencies                                        | knip                                                |
| Managed files match the pack                                                   | `antelopejs-sync --check`                           |
| A CI gate reads `needs.<id>` only of jobs in its `needs`                       | `antelopejs-sync --check`                           |
| Entry-only rules exempt no tracked outsider                                    | `antelopejs-sync --check`                           |
| A DMS layer's `build/backend-boundary.ts` is the pack's plugin                 | `antelopejs-sync --check`                           |
| No `skipLibCheck` in the root tsconfig or one `typecheck` or `build` uses      | `antelopejs-sync --check`                           |
| `build` skips the lib check only over what `typecheck` checks                  | `antelopejs-sync --check`                           |
| `release` runs `typecheck`                                                     | `antelopejs-sync --check`                           |
| A test names the wrong implementation it catches                               | review; no tool                                     |

<!-- antelopejs-guardrails:end -->
