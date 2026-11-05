## Start a project the right way

```bash
ajs project init my-project --template "DMS Demo" --yes
cd my-project
pnpm dev            # backend on :5010
pnpm frontend:dev   # dashboard on :3001
```

1. **Start from the template** rather than a blank page: structure, scripts and configuration are already right.
2. **Create the administrator** on first launch, then your workspace.
3. **Declare your business**: a collection, a data controller, a page made of blocks. The DMS generates the routes, permissions and screens.
4. **Add modules** from *Modules › Browse the store*, or on the command line with `ajs project modules add`. They are written to `antelope.config.ts`, where their configuration stays editable.
5. **Stick to blocks**: a custom component only for what no block covers. That is what keeps a screen editable, translatable and consistent.
