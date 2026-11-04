# `template-dms-adonis`

<div align="center">
<a href="https://discord.gg/g4pFt6eXqu"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord" data-illustration></a>
<a href="https://dms.antelopejs.com/docs/getting-started/adonisjs"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation" data-illustration></a>
</div>

An AdonisJS application that runs the [AntelopeJS DMS](https://dms.antelopejs.com)
and its dashboard inside your own app, in **embedded** mode.

## What it does

- AdonisJS owns the process, with its HTTP server, signals, logger and
  configuration. The DMS starts and stops with it, from
  `providers/antelope_provider.ts`.
- There is no project configuration to maintain. `antelope.config.ts` is a
  placeholder for `ajs project init`, and the DMS modules are ordinary npm
  dependencies, listed in the provider's `modules` map.
- Application code reaches the DMS through `runtime.use()`. `start/routes.ts`
  has an example on `GET /dms/info`.
- The dashboard (`@antelopejs/dms-frontend`) is built against the embedded DMS
  API and served on `:3001`.
- Loads `@antelopejs/dms` with `dms-api`, `dms-database`, `dms-automation` and
  `dms-media`, on MongoDB, `auth-jwt`, local file storage and nodemailer.

Prefer [`template-dms-demo`](https://github.com/AntelopeJS/template-dms-demo)
if you do not already have a Node.js app. There the `ajs` CLI owns the process
(**standalone** mode) and the dashboard runs with hot reload.

## Install

Create a project from this template:

```bash
npx @antelopejs/core project init my-app --template dms-adonis --pm pnpm
cd my-app
cp .env.example .env
node ace generate:key
```

`project init` copies the template and installs its dependencies. It leaves
the `antelope.config.ts` of the template as it is. That file is a placeholder,
and the DMS modules are listed in `providers/antelope_provider.ts`.

You need the Node.js version that `.nvmrc` names, pnpm, and a MongoDB server on
`mongodb://localhost:27017` (`MONGODB_URL` in `.env`).

## Quick start

Start AdonisJS and the embedded DMS:

```bash
pnpm dev
```

AdonisJS listens on `http://localhost:3333` and the DMS API on
`http://localhost:5010`. Check that the DMS answers through AdonisJS:

```bash
curl http://localhost:3333/dms/info
```

In a second terminal, while the backend runs, build and start the dashboard:

```bash
pnpm frontend:build
pnpm frontend:start
```

A fresh database has no account. The `pnpm dev` terminal prints the address
that creates the administrator, with a one-time setup token:

```text
[WARN] [DMS] No owner exists yet. To create it, open http://localhost:3001/onboarding?token=...
```

Open that address. The first-run wizard creates the administrator; after that
the dashboard at `http://localhost:3001` shows the sign-in page. The line
repeats at every start until an administrator exists. To choose the token
yourself, set `DMS_SETUP_TOKEN` in `.env` to at least 16 characters: the line
then prints `token=<DMS_SETUP_TOKEN>` and you put your value in the address. Run
`pnpm frontend:build` again after you add or remove a DMS module.

`ajs dms dev` (hot reload) does not work in embedded mode, because it needs a
backend started by `ajs project dev`. Replace the development secrets of `.env` before
you deploy.

## Documentation

- [Run the DMS inside AdonisJS](https://dms.antelopejs.com/docs/getting-started/adonisjs):
  set-up, configuration, the dashboard and the limitations of embedded mode.
- [Embedded runtime](https://framework.antelopejs.com/docs/guides/embedded-runtime):
  how `createRuntime` works, its lifecycle and `runtime.use()`.
- [Frontend CLI](https://dms.antelopejs.com/docs/frontend/cli/overview):
  `ajs dms build` and `ajs dms start`, and their environment variables.

## Compatibility

The versions this template runs are the ones it pins. `package.json` holds the
ranges of `@adonisjs/core`, `@antelopejs/core`, `@antelopejs/dms` and
`@antelopejs/dms-frontend`, and `pnpm-lock.yaml` holds the versions CI tests.
`.nvmrc` names the Node.js version. CI tests only the AdonisJS major that
`@adonisjs/core` pins.

## The assistant

This template does not load the AI assistant, `@antelopejs/dms-ai`. The assistant lives in the dashboard that `ajs dms dev` serves, so try it in [`template-dms`](https://github.com/AntelopeJS/template-dms) or [`template-dms-demo`](https://github.com/AntelopeJS/template-dms-demo).

There it runs a coding agent, Claude Code or Codex, on your own subscription. When the project runs on your machine, the assistant uses the Claude Code login you already have, with no token and no API key. Codex needs one **Sign in with ChatGPT** in **Assistant** > **Settings**. The [AI assistant section of `template-dms`](https://github.com/AntelopeJS/template-dms#ai-assistant) has the steps, including what a Docker container needs.

## Coding agents

The [AntelopeJS agent skills plugin](https://github.com/AntelopeJS/agent-skills) syncs the
DMS agent skills into the project after `pnpm install`. This repository's
`.claude/settings.json` enables it in Claude Code. In Codex, run
`codex plugin marketplace add AntelopeJS/agent-skills` then
`codex plugin add antelopejs@antelopejs`. `AGENTS.md` holds the agent guidance
for this project. In embedded mode, add a module to the provider's `modules`
map, not with `ajs project modules add`.

## Working on the template itself

Clone the repository instead of scaffolding it:

```bash
git clone https://github.com/AntelopeJS/template-dms-adonis.git
cd template-dms-adonis
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Before you open a pull request, run
`pnpm run checks` (the tests need MongoDB).

## License

[Apache-2.0](./LICENSE)
