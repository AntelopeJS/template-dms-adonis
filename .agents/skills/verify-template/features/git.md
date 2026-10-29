---
covers:
  - .gitignore
docs:
  - README.md
journeys:
  - gitignore
---

# Git

What git leaves out of every clone; a dropped line commits secrets or build output.

## Sub-features

- `gitignore`: `.env`, `.env.local`, `node_modules`, `build`, `.antelope` and `tmp` are ignored, the provider, `.env.example`, `.env.test` and `package.json` are not, and after install and build no secret, dependency or build file is left untracked. This is the Exposure door's journey.

## How to get to it (user POV)

- `git status` in a clone.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" git
```

## Gotchas

- `ajs project init` does not scaffold this template (it is not in the interfaces manifest, and init writes an `antelope.config.ts` and runs `npx tsc` that an AdonisJS application has no use for). The README tells the user to `git clone`, so every journey copies the working tree (tracked and untracked files) into a fresh folder, runs `pnpm install --frozen-lockfile` and writes `.env` the way the README says, pointed at a MongoDB container of its own and free ports. Nothing reaches port 27017 or 3333.
- A journey that needs MongoDB starts `mongo:7` named `<prefix>-template-dms-adonis-mongo-*` and removes it when it ends, even when it fails.
