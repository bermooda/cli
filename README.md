# Official bermooda CLI

CLI for scaffolding and managing [bermooda](https://github.com/bermooda/bermooda) ecommerce shops.

**Package:** `@bermooda/cli`  
**Command:** `bermooda`

Design document: [DESIGN.md](./DESIGN.md) (implementation handoff for agents).

## Install

```bash
npm i -g @bermooda/cli@latest
```

From this repo (development):

```bash
npm install
npm link
bermooda version --cli
```

## Quick start

```bash
bermooda install --local --dir ./my-shop -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'

cd my-shop
bermooda dev
```

Offline / local app checkout (skip npm download):

```bash
bermooda install --local --source /path/to/bermooda --dir ./my-shop -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'
```

### Contributor setup

For engineers working on the app and default extensions with nested git
checkouts (not for merchant installs):

```bash
bermooda dev-setup --local --dir ./bermooda -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'
```

This full-clones `bermooda/bermooda`, then clones `theme-default`,
`plugin-meilisearch`, and `plugin-resend` into `app/themes/default` and
`app/plugins/{meilisearch,resend}` (`.git` kept), then bootstraps deps,
env, DB, admin, and activates those extensions.

## Commands

| Command                                           | Description                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `bermooda install [--local\|--server]`            | Download app, deps, env, DB, admin, store                        |
| `bermooda dev-setup [--local\|--server]`          | Clone app + default extensions as git repos (contributors)       |
| `bermooda update`                                 | Update shop to latest app version (git ff-only or tarball merge) |
| `bermooda plugin add\|update\|remove\|list\|help` | Manage `app/plugins/*`                                           |
| `bermooda theme add\|update\|remove\|list\|help`  | Manage `app/themes/*`                                            |
| `bermooda mcp init`                               | Write Cursor MCP config for this shop                            |
| `bermooda dev`                                    | Dev server (no 1Password `op run`)                               |
| `bermooda start`                                  | Production server (builds if `build/` missing)                   |
| `bermooda version [--cli\|--shop]`                | Versions                                                         |
| `bermooda upgrade`                                | Upgrade this CLI globally                                        |
| `bermooda help [command]`                         | Help                                                             |

Global flags: `--cwd`, `-y` / `--yes`, `--json`, `--verbose`.

### Install flags

| Flag                                                | Description                                       |
| --------------------------------------------------- | ------------------------------------------------- |
| `--local` / `--server`                              | Install profile (SQLite vs PostgreSQL defaults)   |
| `--dir <path>`                                      | Target directory                                  |
| `--source <path>`                                   | Local bermooda app checkout (skip network)        |
| `--ref <tag\|branch>`                               | App git ref (default: `bermooda@latest` from npm) |
| `--admin-email`, `--admin-password`, `--store-name` | Bootstrap credentials                             |
| `--skip-deps`, `--skip-db`                          | Skip npm install or migrate/seed                  |
| `--force`, `--force-env`                            | Non-empty dir / overwrite `.env`                  |
| `--with-demo`                                       | Include demo catalog on server installs           |

### Plugin / theme sources

Default: install from an **npm package name** (official `@bermooda/*` packages and third-party):

```bash
bermooda plugin add @bermooda/plugin-subscriptions
bermooda theme add @bermooda/theme-paper
bermooda plugin add @bermooda/plugin-subscriptions 1.2.0
```

Alternate sources:

```bash
bermooda plugin add my-plugin --path ./packages/my-plugin
bermooda plugin add my-plugin --git https://github.com/org/plugin.git#v1
bermooda plugin add my-plugin --tarball https://example.com/plugin.tgz
bermooda theme list
```

If the npm package is not found, the CLI falls back to the bermooda registry
(when configured). Registry URL: `BERMOODA_REGISTRY_URL` or builtin stub.

### Engine compatibility (`bermooda.engine`)

Plugins and themes must declare a semver range in `package.json` under the
`bermooda` object:

```json
{
  "bermooda": {
    "id": "my-plugin",
    "engine": ">=1.0.0"
  }
}
```

On `plugin add|update` and `theme add|update`, the CLI compares this range
against the shop root `package.json` `version`. Incompatible packages are
rejected before install (exit code 1). The shop must declare a valid semver
`version` field.

## Exit codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | Success              |
| 1    | User / project error |
| 2    | Network / download   |
| 3    | Dependency install   |
| 4    | Database / bootstrap |
| 130  | Interrupted          |

## Requirements

- Node.js ≥ 22.22.0
- Network access to GitHub for remote `install` / `update` (unless `--source`)
- `git` and `tar` recommended
- Shop bootstrap uses app `scripts/cli-bootstrap.mjs` when present (admin + `shopName` + optional minimal seed)

## Development

```bash
npm install
npm test              # vitest run
npm run test:watch    # vitest watch mode
npm run lint          # oxlint + oxfmt --check
npm run fmt           # oxfmt (write)
npm link
bermooda version --cli
```

Unit tests live under `test/` and cover project detection, env generation, registry
resolve, plugin install safety, non-git update merge, bootstrap env wiring, and
command helpers.

Lint/format config matches the app repo (`.oxlintrc.json`, `.oxfmtrc.json`).

## Releasing

Releases are automated with
[release-please](https://github.com/googleapis/release-please) (no local
semantic-release dependencies). Conventional Commits on `master` drive the
version bump; merging the release PR publishes.

1. Use [Conventional Commits](https://www.conventionalcommits.org/) in PR commits
   (or the squash merge subject). Agents must follow [AGENTS.md](./AGENTS.md) and
   [`.cursor/rules/conventional-commits.mdc`](./.cursor/rules/conventional-commits.mdc).
   Bump rules:

   | Commit type                          | Release |
   | ------------------------------------ | ------- |
   | `fix:`, `perf:`, `revert:`           | patch   |
   | `feat:`                              | minor   |
   | `BREAKING CHANGE:` / `feat!:` / …    | major   |
   | `chore:`, `docs:`, `ci:`, `test:`, … | none    |

2. Merge to `master`. [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
   runs [release-please-action](https://github.com/googleapis/release-please-action),
   which opens or updates a **release PR** that bumps `package.json` /
   `package-lock.json` and `CHANGELOG.md`.

3. Merge the release PR. The same workflow then:
   - tags `vX.Y.Z` and creates a GitHub Release
   - runs tests and publishes `@bermooda/cli` via
     [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC)

No manual `npm version` or `--follow-tags` push. No `NPM_TOKEN` secret;
provenance is published automatically. You can also run the workflow manually
via **Actions → Publish → Run workflow** (useful to refresh the release PR).

### One-time npm trusted publisher setup

On the package settings page
([npmjs.com/package/@bermooda/cli](https://www.npmjs.com/package/@bermooda/cli) →
**Settings** → **Trusted Publisher**):

| Field               | Value         |
| ------------------- | ------------- |
| Organization / user | `bermooda`    |
| Repository          | `cli`         |
| Workflow filename   | `publish.yml` |
| Allowed action      | `npm publish` |

Optional: after the first OIDC publish succeeds, set publishing access to
**Require two-factor authentication and disallow tokens**, then revoke any old
automation tokens.

## Related repos

- App: https://github.com/bermooda/bermooda
- Product checklist: `docs/cli-specs.md` in the app repo
- Design: [DESIGN.md](./DESIGN.md)

## Deferred (v1)

- Full plugin marketplace UI / remote registry with many packages
- Enabling plugins via live HTTP admin API
- Docker/Fly deploy automation

## License

MIT
