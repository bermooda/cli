# Agent guide — @bermooda/cli

## Releases and commit messages

Publishing is automated by [semantic-release](https://semantic-release.org/) on
every push to `master` (see `.github/workflows/publish.yml` and
`release.config.js`). **Commit subjects and PR titles must use
[Conventional Commits](https://www.conventionalcommits.org/)** so the correct
semver bump (or no release) is chosen.

### Format

```
<type>(optional-scope): <short description>

[optional body]

[optional footer(s)]
```

- Imperative mood, lowercase description, no trailing period
- Keep the subject ≤ ~72 characters
- Breaking changes: append `!` after the type/scope (`feat!: …`) and/or add a
  `BREAKING CHANGE:` footer

### Types and release impact

These match `release.config.js`. Prefer the most accurate type for the change.

| Type       | When to use                                      | Release |
| ---------- | ------------------------------------------------ | ------- |
| `feat`     | New user-facing capability                       | minor   |
| `fix`      | Bug fix                                          | patch   |
| `perf`     | Performance improvement                          | patch   |
| `revert`   | Revert a previous commit                         | patch   |
| `docs`     | Docs only                                        | none    |
| `style`    | Formatting / lint noise (no behavior change)     | none    |
| `chore`    | Maintenance, deps, tooling that is not a release | none    |
| `refactor` | Internal restructure, no behavior change         | none    |
| `test`     | Tests only                                       | none    |
| `build`    | Build system / packaging                         | none    |
| `ci`       | CI / GitHub Actions / release workflow           | none    |

Examples:

```text
feat: add bermooda mcp init for Cursor agent config
fix(install): default shop source to bermooda@latest from npm
ci: automate npm publish with semantic-release
chore: bump oxlint
docs: document conventional commits for agents
feat!: replace plugin registry API
```

### PR / squash-merge titles

If the PR is squash-merged, **the squash commit subject is what semantic-release
sees**. Titles must also be Conventional Commits (`feat: …`, `fix: …`, etc.).
Do not use titles like “Update publish workflow” or “Address review feedback”.

### Do not version manually

- Do **not** run `npm version`, edit `"version"` in `package.json` for releases,
  or push `v*` tags by hand.
- Do **not** put release notes or version bumps in feature commits;
  semantic-release owns that (`chore(release): x.y.z [skip ci]`).

### npm package contents

`package.json` `"files"` is a whitelist: only `src/`, `README.md`, and `LICENSE`
are published (plus `package.json`). Do not add design docs, tests, workflows,
agent rules, or release config to `"files"` unless they are required at runtime.
`test/npm-package-files.test.js` guards this.

### Choosing the type when unsure

1. User-visible new behavior → `feat`
2. User-visible broken behavior fixed → `fix`
3. Only workflows/docs/tests/tooling → `ci` / `docs` / `test` / `chore`
4. Behavior-neutral code move → `refactor`

If a change mixes a feature and chores, prefer **`feat`** (or **`fix`**) so a
release happens; keep the subject focused on the user-facing part.
