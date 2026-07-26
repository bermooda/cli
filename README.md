# Official bermooda CLI

CLI for scaffolding and managing [bermooda](https://github.com/bermooda/bermooda) ecommerce shops.

**Package:** `bermooda-cli`  
**Command:** `bermooda`

Design document: [DESIGN.md](./DESIGN.md) (implementation handoff for agents).

## Install

```bash
npm i -g bermooda-cli@latest
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

Offline / local app checkout (no GitHub download):

```bash
bermooda install --local --source /path/to/bermooda --dir ./my-shop -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'
```

## Commands

| Command                                           | Description                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `bermooda install [--local\|--server]`            | Download app, deps, env, DB, admin, store                        |
| `bermooda update`                                 | Update shop to latest app version (git ff-only or tarball merge) |
| `bermooda plugin add\|update\|remove\|list\|help` | Manage `app/plugins/*`                                           |
| `bermooda theme add\|update\|remove\|list\|help`  | Manage `app/themes/*`                                            |
| `bermooda dev`                                    | Dev server (no 1Password `op run`)                               |
| `bermooda start`                                  | Production server (builds if `build/` missing)                   |
| `bermooda version [--cli\|--shop]`                | Versions                                                         |
| `bermooda upgrade`                                | Upgrade this CLI globally                                        |
| `bermooda help [command]`                         | Help                                                             |

Global flags: `--cwd`, `-y` / `--yes`, `--json`, `--verbose`.

### Install flags

| Flag                                                | Description                                        |
| --------------------------------------------------- | -------------------------------------------------- |
| `--local` / `--server`                              | Install profile (SQLite vs PostgreSQL defaults)    |
| `--dir <path>`                                      | Target directory                                   |
| `--source <path>`                                   | Local bermooda app checkout (skip network)         |
| `--ref <tag\|branch>`                               | App source ref (default: latest release or `main`) |
| `--admin-email`, `--admin-password`, `--store-name` | Bootstrap credentials                              |
| `--skip-deps`, `--skip-db`                          | Skip npm install or migrate/seed                   |
| `--force`, `--force-env`                            | Non-empty dir / overwrite `.env`                   |
| `--with-demo`                                       | Include demo catalog on server installs            |

### Plugin / theme sources

```bash
bermooda plugin add my-plugin --path ./packages/my-plugin
bermooda plugin add my-plugin --git https://github.com/org/plugin.git#v1
bermooda plugin add my-plugin --tarball https://example.com/plugin.tgz
bermooda theme list
```

Registry URL: `BERMOODA_REGISTRY_URL` or builtin stub until the public index exists.

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
