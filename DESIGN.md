# Design: bermooda-cli (`bermooda`)

**Status:** Implemented (v0.1 scaffold + PR-A1 bootstrap + CLI polish)  
**Source of truth (product intent):** https://github.com/bermooda/bermooda/blob/main/docs/cli-specs.md  
**App repo:** https://github.com/bermooda/bermooda.git  
**CLI repo:** https://github.com/bermooda/bermooda-cli.git (local workspace: `bermooda-cli/`)  
**Package name:** `@bermooda/cli`  
**Binary / command:** `bermooda`

---

## Context

Bermooda is a single-service React Router 7 ecommerce monolith (storefront + admin + API) using Prisma 7, SQLite locally, and optional PostgreSQL for production. Today setup is manual: clone, copy `.env.example`, `npm install`, `npm run setup`, seed admin via `prisma/seed.js` / env defaults.

The CLI productizes that path and adds first-class plugin/theme package management so merchants and developers can:

1. Scaffold a new shop (`install`)
2. Keep the shop and CLI current (`update`, `upgrade`)
3. Manage extensions under `app/plugins/*` and `app/themes/*` (`plugin *`, `theme *`)
4. Run the app (`dev`, `start`)
5. Inspect versions and get help (`version`, `help`)

**Repository model:** The CLI lives in its **own repository** under the same GitHub organisation (`bermooda/bermooda-cli`), not inside the app monorepo. The app remains the installable shop source; the CLI is a thin global tool that downloads and operates on shop checkouts. Small, intentional hooks may still land in the **bermooda** app repo (adapter-aware seed, minimal bootstrap) and are coordinated via a separate app PR plan.

This design is implementation-ready for agent handoff: concrete package layout, command contracts, cross-repo integration points, and a PR plan.

---

## Goals and non-goals

### Goals

- Global npm install: `npm i -g @bermooda/cli@latest` → `bermooda` on PATH
- Interactive and non-interactive (flag-driven) flows for CI/automation
- Safe project root detection so plugin/theme/run commands only operate inside a bermooda shop
- Align install/seed/env with existing app scripts and settings keys (`shopName`, admin via Better Auth credential user, Prisma migrate)
- Extensible plugin/theme registry so third-party packages can be added without changing core discovery (`import.meta.glob('#/plugins/*/index.server.js')`, themes under `app/themes/`)
- Independent versioning and release of CLI vs app (semver tags on `bermooda-cli` repo)

### Non-goals (v1)

- Hosting a full private marketplace UI (registry is a static JSON index + tarball/git sources)
- Hot-reloading plugin enable/disable via CLI (admin already does live enable; CLI installs files + optional enable flag)
- Multi-tenant cloud control plane
- Docker/Fly deploy automation beyond documenting env expectations for `--server`
- Replacing Prisma, auth, or plugin runtime APIs
- Embedding a copy of the full shop app inside the CLI package

---

## Key Decisions

| Decision             | Choice                                                                                                                                                                                                                             | Rationale                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Package location     | **Standalone repo** `bermooda/bermooda-cli` at workspace path `bermooda-cli/`                                                                                                                                                      | User requirement; independent publish/versioning; org already has empty local dir ready               |
| Cross-repo contract  | CLI depends on **documented shop layout + scripts** in `bermooda` (not a private monorepo link). App PRs add bootstrap hooks when needed                                                                                           | Clear ownership: CLI owns UX, app owns DB/auth correctness                                            |
| Runtime              | Node **≥ 22.22.0**, ESM only                                                                                                                                                                                                       | Matches app `engines`                                                                                 |
| CLI framework        | **citty** (or **commander** if team prefers)                                                                                                                                                                                       | Lightweight nested subcommands (`plugin add`)                                                         |
| Prompts              | **@clack/prompts**                                                                                                                                                                                                                 | Clean interactive UX; skip when flags provided                                                        |
| Shop acquisition     | Prefer **GitHub tarball of latest release tag** of `bermooda/bermooda`, fallback to `git clone --depth 1`                                                                                                                          | No need for git on tarball path; works in CI                                                          |
| Project marker       | Root `package.json` with `"name": "bermooda"` **and** presence of `app/core` + `prisma/schema.prisma`                                                                                                                              | Avoid false positives; CLI may also write `.bermooda/project.json` after install                      |
| Local vs server      | `--local` → SQLite + minimal env; `--server` → PostgreSQL + production-oriented secrets prompts                                                                                                                                    | Matches `docs/cli-specs.md` and `docs/postgres.md`                                                    |
| Admin + store setup  | After migrate: invoke **shop-side** bootstrap (env-driven seed or `scripts/cli-bootstrap.mjs` shipped in app). Until app lands it, CLI can shell `npm run seed` with `SEED_ADMIN_*` and a small post-step for `shopName` if needed | Seed already supports `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; shop name is setting key `shopName` |
| Plugin/theme install | Copy package into `app/plugins/<id>` or `app/themes/<id>`, merge optional peer deps into shop root `package.json`, run `npm install`                                                                                               | Runtime discovery is filesystem + `import.meta.glob`                                                  |
| Registry             | Official index URL (default `https://raw.githubusercontent.com/bermooda/registry/main/index.json`) + builtin stub in CLI repo                                                                                                      | Spec assumes plugin/theme repos that do not exist yet                                                 |
| Shop update          | Prefer **git pull --ff-only** when `.git` exists; else download latest app tarball and **merge non-destructive paths**                                                                                                             | Protects `.env`, local plugins/themes, `prisma/*.db`                                                  |
| Self-upgrade         | `npm install -g @bermooda/cli@latest`                                                                                                                                                                                              | Spec’s `bermooda upgrade`                                                                             |
| Dev start            | Spawn `npx react-router dev` with `.env` loaded (**do not** require 1Password `op run`)                                                                                                                                            | App’s `npm run dev` wraps `op run`                                                                    |

---

## Repository layout (`bermooda-cli`)

All CLI code lives in the **standalone** repo root (local: `/Users/cvgellhorn/dev/bermooda-cli`):

```
bermooda-cli/                      # own git repo → github.com/bermooda/bermooda-cli
  package.json                     # name: @bermooda/cli, bin.bermooda
  README.md
  LICENSE
  .gitignore
  src/
    cli.js                         # entry → citty runMain
    commands/
      install.js
      update.js
      upgrade.js
      start.js
      dev.js
      version.js
      help.js
      plugin/
        add.js
        update.js
        remove.js
        list.js
        help.js
      theme/
        add.js
        update.js
        remove.js
        list.js
        help.js
    lib/
      constants.js                 # app repo URL, registry URL, marker files, min Node
      project.js                   # findProjectRoot, assertInShop
      download.js                  # tarball / git clone of bermooda app
      env.js                       # generate .env from prompts + shop .env.example
      db.js                        # provider sync, migrate, generate (via shop scripts)
      bootstrap.js                 # invoke shop seed / cli-bootstrap with env
      registry.js                  # fetch/resolve plugin & theme packages
      fs-install.js                # extract into app/plugins|themes
      package-json.js              # merge deps, read versions
      process.js                   # spawn npm/node with inherited stdio
      logger.js
      prompts.js
    data/
      builtin-registry.json        # stub until public registry exists
  test/
    ...
  .github/
    workflows/
      ci.yml
      publish.yml                  # npm publish on tag
```

**`package.json` (CLI repo):**

```json
{
  "name": "@bermooda/cli",
  "version": "0.1.0",
  "description": "CLI for scaffolding and managing bermooda ecommerce shops",
  "type": "module",
  "bin": {
    "bermooda": "./dist/cli.js"
  },
  "engines": { "node": ">=22.22.0" },
  "files": ["dist", "README.md", "LICENSE"],
  "repository": {
    "type": "git",
    "url": "https://github.com/bermooda/bermooda-cli.git"
  },
  "homepage": "https://github.com/bermooda/bermooda-cli",
  "bugs": "https://github.com/bermooda/bermooda-cli/issues"
}
```

Build: esbuild/unbuild to `dist/`, or ship plain ESM from `src/` with `"bin": { "bermooda": "./src/cli.js" }` for v1 simplicity.

**App repo stays separate.** No `packages/cli` under bermooda. App-only changes (seed adapter, minimal bootstrap script, README pointer to CLI) land in `bermooda/bermooda`.

### Cross-repo dependency diagram

```
npm i -g @bermooda/cli         →  publishes from bermooda/bermooda-cli
bermooda install               →  downloads github.com/bermooda/bermooda
bermooda plugin/theme *        →  registry + filesystem under shop checkout
bermooda seed/bootstrap        →  runs scripts inside the shop (app repo code)
```

Constants in CLI:

```js
export const APP_REPO = 'https://github.com/bermooda/bermooda.git';
export const APP_REPO_SLUG = 'bermooda/bermooda';
export const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/bermooda/registry/main/index.json';
```

---

## Command surface

Global form: `bermooda <command...> [options]`

Global options (all commands):

| Flag           | Description                                  |
| -------------- | -------------------------------------------- |
| `--cwd <path>` | Working directory (default: `process.cwd()`) |
| `--yes` / `-y` | Accept defaults; never block on prompts      |
| `--json`       | Machine-readable output where applicable     |
| `--verbose`    | Debug logging                                |
| `--help`       | Command help                                 |

### `bermooda install [--local|--server]`

Creates a new shop directory by downloading the **app** repository (not the CLI).

**Flags:**

| Flag                                | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `--local`                           | Local/dev profile (default if neither set and TTY)            |
| `--server`                          | Server/production profile                                     |
| `--dir <path>`                      | Target directory (default: `./bermooda` or prompted)          |
| `--ref <tag\|branch\|sha>`          | App source ref (default: latest release tag, else `main`)     |
| `--db <sqlite\|postgresql>`         | Override DB (local default sqlite; server default postgresql) |
| `--database-url <url>`              | Skip URL prompt                                               |
| `--admin-email`, `--admin-password` | Admin credentials                                             |
| `--store-name <name>`               | Shop display name → `shopName` setting                        |
| `--skip-deps`                       | Skip `npm install`                                            |
| `--skip-db`                         | Skip migrate/seed                                             |
| `--force`                           | Allow install into non-empty dir (use carefully)              |
| `--force-env`                       | Overwrite existing `.env`                                     |
| `--no-interactive`                  | Fail if required values missing (with `--yes` uses defaults)  |

**Flow:**

1. Resolve mode (`local` | `server`); error if both flags set.
2. Resolve target dir; refuse non-empty dir unless `--force`.
3. Download **bermooda app** source into target:
   - `GET https://api.github.com/repos/bermooda/bermooda/releases/latest` → tarball URL, or
   - `git clone --depth 1 --branch <ref> https://github.com/bermooda/bermooda.git <dir>`
4. Write `.bermooda/project.json`: `{ "cliVersion", "installedAt", "installMode", "sourceRef", "appRepo" }`.
5. `npm install` in target (match app docs / Cloud Agent: use `--legacy-peer-deps` only if required).
6. Interactive env generation (see **Environment generation**).
7. DB provider sync: if postgresql, run shop’s `node scripts/sync-prisma-provider.js` with env set.
8. `npx prisma generate` + `npx prisma migrate deploy` (same as shop `npm run setup`).
9. Bootstrap admin + store name (see **Bootstrap**).
10. Print next steps: `cd <dir> && bermooda dev`.

### `bermooda update`

Updates an existing shop’s **app** code to the latest version.

**Preconditions:** `assertInShop(cwd)`.

**Strategy:**

1. Detect git remote and working tree cleanliness for core paths.
2. **Git shops:** `git fetch` + fast-forward merge/pull of app default branch. Abort on dirty conflict-prone paths; allow dirty for `.env`, user plugins/themes, `prisma/*.db`.
3. **Non-git shops:** download latest app tarball to temp; copy allowlisted core paths; never overwrite `.env`, `.bermooda/`, DB files, or user-installed plugins/themes not in the release.
4. `npm install`
5. Provider sync + `npm run setup`
6. Optional: print GitHub release notes for the app

**Flags:** `--ref`, `--dry-run`, `--yes`

### `bermooda plugin add <plugin-name> [version]`

1. `assertInShop`
2. Resolve package from registry (`type: "plugin"`, name or id) or alternate source flags
3. Download version (default latest semver)
4. Extract to `app/plugins/<id>/` (id from package manifest)
5. Validate required plugin shape (`manifest` / `index.server.js`)
6. Merge declared peer/extra deps into shop root; `npm install`
7. `--enable` optional (default **off**): update `enabledPlugins` via shop helper/DB if available

**Alternate sources:** `--path <dir>`, `--git <url>#ref`, `--tarball <url>`

### `bermooda plugin update|remove|list|help`

As in original design: update with backup under `.bermooda/backups/plugins/`, remove best-effort from settings, list from filesystem (+ enabled if DB up).

### `bermooda theme add|update|remove|list|help`

Mirror plugins targeting `app/themes/<id>/`. Support `--activate` to set `activeTheme`. Never remove the only remaining theme if it is `default` without confirmation.

### `bermooda version [--cli|--shop]`

- `--cli`: version of the installed `@bermooda/cli` package
- `--shop`: shop `package.json` version + `.bermooda/project.json` sourceRef
- neither: both

### `bermooda upgrade`

Upgrade the **CLI** globally (`npm install -g @bermooda/cli@latest`), detecting npm/pnpm/yarn when possible.

### `bermooda start` / `bermooda dev`

`assertInShop`, load `.env` into child env, spawn:

| Command | Spawn                                                          |
| ------- | -------------------------------------------------------------- |
| `dev`   | `npx react-router dev --port 3000 --host` (not `op run`)       |
| `start` | `npm run start`; if build missing, build first or fail clearly |

---

## Environment generation

Source template: **shop** `.env.example` after download.

**Always generate / ensure:**

| Variable              | Local default          | Server behavior              |
| --------------------- | ---------------------- | ---------------------------- |
| `DATABASE_URL`        | `file:./prisma/dev.db` | Prompt for Postgres URL      |
| `DATABASE_PROVIDER`   | omit or `sqlite`       | `postgresql` when applicable |
| `QUEUE_DATABASE_PATH` | `./prisma/queue.db`    | same                         |
| `BETTER_AUTH_SECRET`  | random 32-byte hex     | random, required             |
| `HEALTH_TOKEN`        | random                 | random                       |

**Prompt tiers:**

1. **Required for boot:** DB URL (server), admin email/password, store name
2. **Optional integrations** (skip with Enter / `--yes`): Resend, Stripe, Google OAuth, Telegram, Storage, Meilisearch, Polar

Never commit `.env`. Existing `.env` → abort or `--force-env`.

---

## Bootstrap (admin + store)

Reuse app concepts (no parallel auth in the CLI package):

- Admin: `User` `role: 'admin'`, credential `Account`, bcrypt (see [bermooda/prisma/seed.js](bermooda/prisma/seed.js))
- Store name: setting key `shopName` ([bermooda/app/core/settings/keys.js](bermooda/app/core/settings/keys.js))

**App repo PR (required for robust install):**

Add `scripts/cli-bootstrap.mjs` (or fix seed) that:

1. Selects Prisma adapter from `DATABASE_URL` / `DATABASE_PROVIDER` (today seed hardcodes SQLite — **must fix for `--server`**)
2. Upserts admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
3. Upserts `shopName` from `SEED_SHOP_NAME`
4. Supports `BERMOODA_MINIMAL_SEED=1` to skip demo catalog

**CLI:** set env and run from shop root:

```bash
SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... SEED_SHOP_NAME=... \
  BERMOODA_MINIMAL_SEED=1 node scripts/cli-bootstrap.mjs
```

Fallback until app PR merges: `npm run seed` with admin env only + document that shop name may need admin UI (or CLI temporary SQLite-only path).

---

## Registry format

**URL:** `BERMOODA_REGISTRY_URL` or default `https://raw.githubusercontent.com/bermooda/registry/main/index.json`

**Schema (v1):** packages with `name`, `id`, `type` (`plugin`|`theme`), `versions`, `latest`, tarball + optional integrity + `minBermoodaVersion`.

Until registry exists: ship `src/data/builtin-registry.json` in **this CLI repo**; support `--path` / `--git` / `--tarball`.

---

## Project root detection

```js
function findProjectRoot(startDir) {
  // walk up: package.json name === 'bermooda'
  // && exists app/core && exists prisma/schema.prisma
  // optional: .bermooda/project.json
}
```

Mutating commands call `assertInShop` → exit 1 if not found.

---

## Error handling and exit codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 0    | Success                            |
| 1    | User/input/project error           |
| 2    | Network / download failure         |
| 3    | Dependency install failure         |
| 4    | Database migrate/bootstrap failure |
| 130  | Interrupted (SIGINT)               |

Atomic `.env` write (temp + rename). Zip-slip safe extracts. No password logging. HTTPS-only registry. Safe plugin/theme ids: `^[a-z0-9-]+$`.

---

## Testing strategy (CLI repo)

| Layer        | What                                                              |
| ------------ | ----------------------------------------------------------------- |
| Unit         | project detection, env merge, registry resolve, path-safe extract |
| Integration  | fixture “fake shop” tree + local path plugin install              |
| Smoke        | `bermooda version --cli` in CI                                    |
| Optional e2e | install from app tarball against network (nightly / manual)       |

---

## App changes required (`bermooda` repo)

Coordinated but **separate** from CLI commits:

1. Adapter-aware seed / `scripts/cli-bootstrap.mjs` (SQLite + PostgreSQL)
2. Minimal seed mode + `SEED_SHOP_NAME`
3. Optional: `dev:plain` script without `op run` (CLI can spawn react-router regardless)
4. README Getting Started: prefer `npm i -g @bermooda/cli && bermooda install`
5. Optional link from [docs/cli-specs.md](bermooda/docs/cli-specs.md) to CLI repo README

No plugin discovery changes if packages land in `app/plugins/<id>/`.

---

## Documentation

| Location                          | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `bermooda-cli/README.md`          | Primary CLI docs, install, all commands       |
| `bermooda/docs/cli.md` (optional) | Points users to CLI package/repo              |
| `bermooda/README.md`              | Getting Started uses global CLI               |
| `bermooda/docs/cli-specs.md`      | Product checklist; check off as features land |

---

## Alternatives considered

| Alternative                            | Why not                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| Monorepo `packages/cli` under bermooda | **Rejected** — CLI is its own org repo (`bermooda-cli`) |
| Embed full app in CLI npm package      | Huge package; version coupling nightmare                |
| Plugins as pure npm runtime imports    | App discovery is glob under `app/plugins`               |
| Always git clone only                  | Fails without git; tarball more portable                |

---

## Open Questions (resolved defaults)

| Question                      | Default                                                |
| ----------------------------- | ------------------------------------------------------ |
| CLI in monorepo or own repo?  | **Own repo `bermooda/bermooda-cli`** (confirmed)       |
| Enable plugins on add?        | **No** — require `--enable`                            |
| Demo catalog on install?      | **Yes** local; **minimal** server unless `--with-demo` |
| Registry before public index? | **Builtin stub + path/git/tarball**                    |
| Non-empty install dir?        | **Require `--force`**                                  |

---

## PR Plan

Work is split across **two repositories**. Agents should open PRs in the correct repo.

### CLI repo (`bermooda/bermooda-cli`) — implement in `/Users/cvgellhorn/dev/bermooda-cli`

#### PR-C1 — Scaffold + meta commands — **done**

- **Title:** `feat: scaffold bermooda-cli with version, help, upgrade`
- **Paths:** `package.json`, `src/cli.js`, `src/commands/{version,help,upgrade}.js`, `src/lib/*` minimal, CI
- **Deps:** none
- **Scope:** bin entry, citty, `bermooda version --cli`, help, upgrade stub

#### PR-C2 — Project detection + dev/start — **done**

- **Title:** `feat: project root detection and dev/start`
- **Paths:** `src/lib/project.js`, `src/commands/{dev,start}.js`
- **Deps:** PR-C1
- **Scope:** assertInShop against a fixture shop tree; dotenv load; spawn

#### PR-C3 — `install` — **done**

- **Title:** `feat: install command (download app, deps, env, db, admin)`
- **Paths:** `src/commands/install.js`, `src/lib/{download,env,db,bootstrap}.js`
- **Deps:** PR-C1; preferably **PR-A1** merged in app (or graceful fallback)
- **Scope:** local/server flags, GitHub download of `bermooda/bermooda`, full flow; also `--source` for local checkout

#### PR-C4 — `update` — **done**

- **Title:** `feat: update existing shop to latest app version`
- **Paths:** `src/commands/update.js`, `src/lib/update-merge.js`
- **Deps:** PR-C3
- **Scope:** git ff-only + non-git merge; preserve secrets and user extensions

#### PR-C5 — Registry + plugin commands — **done**

- **Title:** `feat: plugin add/update/remove/list`
- **Paths:** `src/commands/plugin/*`, `src/lib/{registry,fs-install}.js`, `src/data/builtin-registry.json`
- **Deps:** PR-C2
- **Scope:** path/git/tarball sources; zip-slip safety

#### PR-C6 — Theme commands — **done**

- **Title:** `feat: theme add/update/remove/list`
- **Paths:** `src/commands/theme/*`
- **Deps:** PR-C5
- **Scope:** shared install path; `--activate` (hint only; admin UI for DB write)

#### PR-C7 — Docs + npm publish workflow — **done**

- **Title:** `docs+ci: README and publish bermooda-cli on tag`
- **Paths:** `README.md`, `.github/workflows/{ci,publish}.yml`
- **Deps:** PR-C3+ stable surface
- **Scope:** `npm publish` on `v*` tags; usage examples

### App repo (`bermooda/bermooda`) — supporting hooks

#### PR-A1 — CLI bootstrap hooks — **done**

- **Title:** `feat(seed): adapter-aware minimal bootstrap for CLI install`
- **Paths:** `prisma/seed.js`, `scripts/cli-bootstrap.mjs`, `scripts/cli-bootstrap.test.js`
- **Deps:** none (can start in parallel with PR-C1)
- **Scope:** Postgres+SQLite; `SEED_SHOP_NAME`; `BERMOODA_MINIMAL_SEED`

#### PR-A2 — Docs pointer to CLI — **done**

- **Title:** `docs: Getting Started via bermooda-cli`
- **Paths:** `README.md`, optional `docs/cli.md`, update `docs/cli-specs.md`
- **Deps:** first published CLI release or PR-C3 usable from git
- **Scope:** document `npm i -g @bermooda/cli` and link to CLI repo

**Suggested order:** PR-A1 ∥ PR-C1 → PR-C2 → PR-C3 (after A1) → PR-C4 / PR-C5 → PR-C6 → PR-C7 + PR-A2.

### Deferred (explicit)

| Item                                             | Reason                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Full marketplace registry packages               | Public `bermooda/registry` index not populated yet; builtin stub + path/git/tarball work |
| Plugin `--enable` / theme `--activate` DB writes | Requires live app DB helpers; admin UI remains source of truth                           |
| Embedding app in CLI package                     | Non-goal                                                                                 |
| Docker/Fly deploy automation                     | Non-goal                                                                                 |

---

## Verification (end-to-end)

1. In CLI repo: implement, pack, install globally from local path:

   ```bash
   cd /Users/cvgellhorn/dev/bermooda-cli
   npm install && npm link   # or npm pack && npm i -g ./bermooda-cli-*.tgz
   bermooda version --cli
   ```

2. Clean temp install of shop:

   ```bash
   bermooda install --local --dir ./my-shop -y \
     --admin-email admin@example.com --admin-password 'TestPass123!' \
     --store-name 'Demo Shop'
   cd my-shop && bermooda dev
   ```

3. Admin login + shop name; `bermooda plugin list`; `bermooda update --dry-run`.

4. With Postgres: `bermooda install --server --database-url "$DATABASE_URL" -y ...` after PR-A1.

---

## Implementation notes for agents

- **Write all CLI code under `/Users/cvgellhorn/dev/bermooda-cli`**, not under `bermooda/packages`.
- App changes only under `/Users/cvgellhorn/dev/bermooda` when implementing PR-A\*.
- Prefer ESM, Node 22+, JS + JSDoc in CLI.
- Do not shell out to `op run`.
- Keep commands thin; test `lib/*`.
- Command names must match [docs/cli-specs.md](bermooda/docs/cli-specs.md) exactly.
- CLI package name `@bermooda/cli`, binary `bermooda`.

---

## Success criteria

- Spec commands implemented with documented flags
- Zero-to-running-shop without reading Prisma docs
- Plugin/theme install lands where the platform discovers them
- Published as `@bermooda/cli` from **standalone** org repo; binary `bermooda`
- PR plan executable by separate agents per repo without redesign
