# Implementation session prompt

Copy everything below the line into a new agent session.

---

## Task

Implement the **bermooda-cli** end-to-end per the approved design. Work is split across two repos. Prefer finishing gaps and hardening the existing scaffold over rewriting from scratch.

## Canonical docs (read first)

1. **Design (source of truth for implementation):**  
   `/Users/cvgellhorn/dev/bermooda-cli/DESIGN.md`
2. **Product command checklist:**  
   `/Users/cvgellhorn/dev/bermooda/docs/cli-specs.md`
3. **App pointer:**  
   `/Users/cvgellhorn/dev/bermooda/docs/cli-design.md`
4. **App conventions (seed, env, plugins, themes):**
   - `/Users/cvgellhorn/dev/bermooda/AGENTS.md`
   - `/Users/cvgellhorn/dev/bermooda/.env.example`
   - `/Users/cvgellhorn/dev/bermooda/prisma/seed.js`
   - `/Users/cvgellhorn/dev/bermooda/docs/plugins.md`
   - `/Users/cvgellhorn/dev/bermooda/docs/themes.md`
   - `/Users/cvgellhorn/dev/bermooda/docs/postgres.md`
   - `/Users/cvgellhorn/dev/bermooda/app/core/settings/keys.js` (`shopName`)
   - `/Users/cvgellhorn/dev/bermooda/scripts/sync-prisma-provider.js`

## Repos and naming

| Item                                         | Value                                |
| -------------------------------------------- | ------------------------------------ |
| CLI workspace                                | `/Users/cvgellhorn/dev/bermooda-cli` |
| App workspace                                | `/Users/cvgellhorn/dev/bermooda`     |
| npm package                                  | `@bermooda/cli`                      |
| Binary / command                             | `bermooda`                           |
| CLI does **not** live under the app monorepo | No `packages/cli` in bermooda        |

## Current state (already done)

Scaffold exists in `bermooda-cli`:

- `package.json` with bin → `src/cli.js` (citty, @clack/prompts, dotenv, picocolors)
- Commands: install, update, plugin/_, theme/_, dev, start, version, upgrade, help
- Libs: project detection, download, env, db, bootstrap, registry, fs-install, etc.
- Unit tests: `test/project.test.js`, `test/env.test.js` (passing)
- `DESIGN.md`, `README.md`, `IMPLEMENTATION-PROMPT.md`

**Known gaps to close (priority order):**

### A. App repo (`bermooda`) — PR-A1 first

1. Add **`scripts/cli-bootstrap.mjs`** (or fix `prisma/seed.js`) that:
   - Selects Prisma adapter from `DATABASE_URL` / `DATABASE_PROVIDER` (seed today hardcodes SQLite — breaks `--server`)
   - Upserts admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (same pattern as seed: User + credential Account + bcrypt)
   - Upserts setting `shopName` from `SEED_SHOP_NAME`
   - Supports `BERMOODA_MINIMAL_SEED=1` to skip demo catalog
2. Wire npm script if useful (e.g. `"cli:bootstrap": "node scripts/cli-bootstrap.mjs"`)
3. Add tests for bootstrap where practical

### B. CLI repo — harden and complete

1. **install** — E2E against real or local app checkout:
   - Non-empty dir / `--force`, env generation, postgres path, bootstrap via `cli-bootstrap.mjs` when present
   - Interactive + `-y` paths; never log admin password
2. **update** — Finish non-git tarball merge strategy (design PR-C4); git ff-only already sketched
3. **plugin / theme** — Registry resolve, path/git/tarball, zip-slip safety, backups on update, list from filesystem
4. **dev / start** — Confirm no `op run`; load shop `.env`; build-if-missing for start
5. **Tests** — Expand unit coverage (registry, fs-install path safety, env); fixture shop for plugin list/add `--path`
6. **CI** — `.github/workflows/ci.yml` (test + smoke `node src/cli.js version --cli`)
7. **Publish** — `.github/workflows/publish.yml` runs release-please on `master` (OIDC)
8. **Docs** — Keep `README.md` accurate; optional PR-A2: app `README.md` Getting Started → `npm i -g @bermooda/cli && bermooda install`

## Hard requirements

- Command names match `docs/cli-specs.md` exactly (`install`, `update`, `plugin add|update|remove|list|help`, `theme …`, `help`, `version`, `upgrade`, `start`, `dev`)
- Node ≥ 22.22.0, ESM only
- Do **not** shell out to 1Password `op run` for `dev`
- Project root: `package.json` name `"bermooda"` + `app/core` + `prisma/schema.prisma`
- Plugins → `app/plugins/<id>/`; themes → `app/themes/<id>/` (platform uses `import.meta.glob`)
- Exit codes: 0 ok, 1 user, 2 network, 3 deps, 4 db, 130 sigint
- Safe ids: `^[a-z0-9-]+$`; HTTPS-only remote tarballs/registry
- Prefer small, reviewable commits/PRs per DESIGN.md PR plan (PR-A1 ∥ then CLI polish C3–C7)

## Suggested execution order

1. Implement **PR-A1** in `bermooda` (bootstrap script) and verify with existing seed patterns
2. In `bermooda-cli`, point bootstrap at `scripts/cli-bootstrap.mjs` and verify
3. Manual smoke:
   ```bash
   cd /Users/cvgellhorn/dev/bermooda-cli && npm install && npm link
   bermooda version --cli
   # Prefer installing from local path if network clone is heavy — or:
   bermooda install --local --dir /tmp/bermooda-smoke -y \
     --admin-email admin@example.com --admin-password 'TestPass123!' \
     --store-name 'Demo Shop'
   cd /tmp/bermooda-smoke && bermooda plugin list && bermooda version --shop
   ```
4. Fix failures; add tests for each gap closed
5. Document remaining non-goals (full marketplace registry, non-git update edge cases) if deferred

## Out of scope (v1)

- Full plugin marketplace UI
- Embedding the app inside the CLI package
- Docker/Fly deploy automation
- Enabling plugins via live HTTP admin API

## Definition of done

- [x] `npm test` passes in `bermooda-cli`
- [x] `bermooda version --cli` works via `npm link`
- [x] `bermooda install --local -y …` produces a runnable shop (or documented blocker if GitHub download fails offline)
- [x] Admin + `shopName` set via app bootstrap on SQLite
- [x] `plugin list` / `theme list` work inside a shop; `plugin add --path` works
- [x] `dev` starts without `op run`
- [x] DESIGN.md PR checklist items either done or explicitly marked deferred with reason

**Implemented (2026-07-11):** PR-A1 (`scripts/cli-bootstrap.mjs` + adapter-aware seed), CLI install `--source`, non-git update merge, plugin/theme hardening, CI/publish workflows, expanded tests. Offline install: use `--source <app-checkout>`.

Start by reading `DESIGN.md` fully, then inventory `bermooda-cli/src` against the PR plan and implement the highest-impact gaps first (PR-A1 + install bootstrap).
