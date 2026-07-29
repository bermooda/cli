# Agent guide — @bermooda/cli

## Releases and commit messages

Publishing is automated by
[release-please](https://github.com/googleapis/release-please) on every push to
`master` (see `.github/workflows/publish.yml` and `release-please-config.json`).
**Commit subjects and PR titles must use
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

These match `release-please-config.json` `changelog-sections`. Prefer the most
accurate type for the change.

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
ci: switch publish workflow to release-please
chore: bump oxlint
docs: document conventional commits for agents
feat!: replace plugin registry API
```

### How the release flow works

1. Merge a Conventional Commit PR to `master`.
2. release-please opens or updates a **release PR** (version bump + `CHANGELOG.md`).
3. Merge that release PR. release-please tags `vX.Y.Z`, creates a GitHub Release,
   and the publish job runs `npm publish` via OIDC.

### PR / squash-merge titles

If the PR is squash-merged, **the squash commit subject is what release-please
sees**. Titles must also be Conventional Commits (`feat: …`, `fix: …`, etc.).
Do not use titles like “Update publish workflow” or “Address review feedback”.

### Do not version manually

- Do **not** run `npm version`, edit `"version"` in `package.json` for releases,
  or push `v*` tags by hand.
- Do **not** put release notes or version bumps in feature commits;
  release-please owns that (release PR titled like
  `chore(master): release 1.2.3`).

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
