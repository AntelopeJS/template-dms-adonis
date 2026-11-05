## Contributing the right way

The DMS and its modules are open source. To get a contribution accepted quickly:

- **Discuss first** any significant feature in an issue.
- **One branch, one topic** — one fix or feature per pull request, small and reviewable.
- **Generic in modules, specific in the project** — a module never holds a client's content; a generic option with a safe default, yes.
- **Run the repository's checks** (formatting, lint, types, tests) and add tests and documentation when behaviour changes.
- **Conventional commits** (`fix(api): …`, `feat(tables): …`) and a description that explains the problem, the solution and the test evidence.
- **Maintainers merge and publish**; the project then bumps the module's version.
