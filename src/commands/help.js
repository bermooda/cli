import pc from 'picocolors';

const TOPICS = {
  'install': `bermooda install [--local|--server]

Download the bermooda app, install dependencies, configure .env, database,
admin user, store name, and default extensions (theme + Meilisearch + email).

Options:
  --local              Local/dev profile (SQLite default)
  --server             Server/production profile (PostgreSQL default)
  --dir <path>         Target directory
  --ref <ref>          App git tag/branch (default: bermooda@latest from npm)
  --db <sqlite|postgresql>
  --database-url <url>
  --admin-email <email>
  --admin-password <pass>
  --store-name <name>
  --email-provider <resend|sendgrid|aws-ses>
                       Email provider for transactional mail (default: resend)
  --skip-deps          Skip npm install
  --skip-db            Skip migrate/seed and extension install
  --force              Allow non-empty target directory
  --force-env          Overwrite existing .env
  -y, --yes            Non-interactive defaults (email provider → resend)

Environment:
  BERMOODA_EXTENSIONS_PATH  Parent directory containing sibling extension
                            checkouts (e.g. theme-default/, plugin-meilisearch/).
                            Used as a local fallback before npm.
`,

  'dev-setup': `bermooda dev-setup

Contributor setup: full-clone the bermooda app and default extensions
(theme-default, plugin-meilisearch, plugin-resend) as nested git repos
under app/themes and app/plugins, then bootstrap deps, .env, database,
admin user, and activate/enable those extensions.

Not for merchant installs — use bermooda install for that.

Options:
  --local              Local/dev profile (SQLite default)
  --server             Server/production profile (PostgreSQL default)
  --dir <path>         Target directory (default: ./bermooda)
  --ref <ref>          App git tag/branch (default: repo default branch)
  --db <sqlite|postgresql>
  --database-url <url>
  --admin-email <email>
  --admin-password <pass>
  --store-name <name>
  --skip-deps          Skip npm install
  --skip-db            Skip migrate/seed and extension settings
  --force              Replace non-empty target directory (destructive)
  --force-env          Overwrite existing .env
  -y, --yes            Non-interactive defaults
`,

  'update': `bermooda update

Update an existing shop to the latest app version.
Prefer git fast-forward when .git exists; otherwise merge from tarball.

Options:
  --ref <ref>          Target ref
  --dry-run            Print plan only
  -y, --yes
`,

  'upgrade': `bermooda upgrade

Upgrade the global @bermooda/cli package to latest.
`,

  'plugin': `bermooda plugin <add|update|remove|list|help> [args]

  plugin add <npm-package> [version]   Install from npm into app/plugins/<id>
  plugin update <npm-package> [version]
  plugin remove <id>
  plugin list
  plugin help

Default source is the npm package name (official + third-party), e.g.:
  bermooda plugin add @bermooda/plugin-subscriptions

Alternate sources: --path, --git, --tarball
  --skip-deps          Skip merging peer deps / npm install
  --enable             Enable after add (writes shop settings via scripts/cli-set-extensions.mjs)
`,

  'theme': `bermooda theme <add|update|remove|list|help> [args]

  theme add <npm-package> [version]    Install from npm into app/themes/<id>
  theme update <npm-package> [version]
  theme remove <id>
  theme list
  theme help

Default source is the npm package name (official + third-party), e.g.:
  bermooda theme add @bermooda/theme-paper

Alternate sources: --path, --git, --tarball
  --skip-deps          Skip merging peer deps / npm install
  --activate           Set activeTheme after add (writes shop settings via scripts/cli-set-extensions.mjs)
`,

  'start': `bermooda start

Production server (npm run start). Builds first if build/ is missing.
`,

  'dev': `bermooda dev

Development server (npx react-router dev). Loads .env without 1Password op run.
`,

  'version': `bermooda version [--cli|--shop]

Show CLI and/or shop versions.
`,

  'mcp': `bermooda mcp init [--url <url>] [--key <key>]

Write .cursor/mcp.json for Cursor (and a hint for Claude Desktop) using
BERMOODA_URL + BERMOODA_API_KEY from shop .env, or .bermooda/bootstrap-api-key.

Options:
  --url <url>          Shop URL (default: BERMOODA_URL or http://localhost:3000)
  --key <key>          Admin API key (berm_*)
  --force              Replace invalid existing .cursor/mcp.json
  -y, --yes
  --json               Output { url, keyPresent, path } (key never included)
`,
};

/**
 * @param {{ command?: string }} args
 */
export async function helpCommand(args = {}) {
  const cmd = args.command;

  if (cmd && TOPICS[cmd]) {
    console.log(TOPICS[cmd]);
    return;
  }

  if (cmd) {
    console.log(`Unknown help topic: ${cmd}\n`);
  }

  console.log(`${pc.bold('bermooda')} — manage bermooda ecommerce shops

${pc.bold('Usage:')}
  bermooda <command> [options]

${pc.bold('Commands:')}
  install     Create a new shop from the latest app release
  dev-setup   Clone app + default extensions for contributors
  update      Update shop app code to latest
  plugin      Manage plugins (add|update|remove|list|help)
  theme       Manage themes (add|update|remove|list|help)
  mcp         MCP config for agents (init)
  dev         Start development server
  start       Start production server
  version     Show CLI / shop version
  upgrade     Upgrade @bermooda/cli globally
  help        Show help for a command

${pc.bold('Global options:')}
  --cwd <path>   Working directory
  -y, --yes      Accept defaults (non-interactive)
  --json         Machine-readable output (where supported)
  --verbose      Debug logging

Run ${pc.cyan('bermooda help <command>')} for details.
`);
}
