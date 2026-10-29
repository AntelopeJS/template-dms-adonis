---
covers:
  - .gitignore
docs:
  - README.md
journeys:
  - gitignore
---

# Git

What git leaves out of every scaffolded project; a dropped line commits secrets or build output.

## Sub-features

- `gitignore`: `.env`, `.env.local`, `node_modules`, `build`, `.antelope` and `tmp` are ignored, the provider, `.env.example`, `.env.test` and `package.json` are not, and after install and build no secret, dependency or build file is left untracked. This is the Exposure door's journey.

## How to get to it (user POV)

- `git status` in a scaffolded project.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" git
```

## Gotchas

- Every journey scaffolds the project the way the README says: `ajs project init` from an offline manifest that lists the working tree (tracked and untracked files) as a project template, then `pnpm install --frozen-lockfile`, and writes `.env` the way the README says (`cp .env.example .env`, `node ace generate:key`), pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
