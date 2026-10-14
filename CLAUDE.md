# AntelopeJS DMS inside AdonisJS

This AdonisJS application runs the AntelopeJS DMS as an embedded guest runtime:
there is no `antelope.config.ts`. `providers/antelope_provider.ts` creates the
runtime with `createRuntime` and lists the modules, which are ordinary npm
dependencies. Host code reaches the DMS through
`runtime.use('<interface package>[/subpath]')`, never by importing an
`@antelopejs/interface-*` package.

The DMS guidance ships as skills inside its packages. The antelopejs Claude Code
plugin syncs them into `.claude/skills/` once `pnpm install` has run, on session
start and after installs; `.claude/settings.json` offers to install it when you
trust this folder. If they seem missing, run `/antelopejs:sync-skills`;
`/antelopejs:skills` lists what is synced.

Start with the `dms` skill for the mental model and its routing, and follow
`dms-best-practices` when building pages and blocks. The DMS skills assume an
`ajs`-driven project when they talk about `antelope.config.ts` and dev servers:
here, configure modules in the provider and run the app with `pnpm dev`.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
