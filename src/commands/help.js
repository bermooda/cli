import pc from 'picocolors';

const TOPICS = {
  install: `bermooda install [--local|--server]

Download the bermooda app, install dependencies, configure .env, database,
admin user, and store name.

Options:
  --local              Local/dev profile (SQLite default)
  --server             Server/production profile (PostgreSQL default)
  --dir <path>         Target directory
  --ref <ref>          App git tag/branch (default: latest release or main)
  --db <sqlite|postgresql>
  --database-url <url>
  --admin-email <email>
  --admin-password <pass>
  --store-name <name>
  --skip-deps          Skip npm install
  --skip-db            Skip migrate/seed
  --force              Allow non-empty target directory
  --force-env          Overwrite existing .env
  -y, --yes            Non-interactive defaults
`,

  update: `bermooda update

Update an existing shop to the latest app version.
Prefer git fast-forward when .git exists; otherwise merge from tarball.

Options:
  --ref <ref>          Target ref
  --dry-run            Print plan only
  -y, --yes
`,

  upgrade: `bermooda upgrade

Upgrade the global bermooda-cli package to latest.
`,

  plugin: `bermooda plugin <add|update|remove|list|help> [args]

  plugin add <name> [version]   Install into app/plugins/<id>
  plugin update <name> [version]
  plugin remove <name>
  plugin list
  plugin help

Sources: registry name, --path, --git, --tarball
  --enable             Enable after add (default: off)
`,

  theme: `bermooda theme <add|update|remove|list|help> [args]

  theme add <name> [version]    Install into app/themes/<id>
  theme update <name> [version]
  theme remove <name>
  theme list
  theme help

  --activate           Set activeTheme after add
`,

  start: `bermooda start

Production server (npm run start). Builds first if build/ is missing.
`,

  dev: `bermooda dev

Development server (npx react-router dev). Loads .env without 1Password op run.
`,

  version: `bermooda version [--cli|--shop]

Show CLI and/or shop versions.
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
  update      Update shop app code to latest
  plugin      Manage plugins (add|update|remove|list|help)
  theme       Manage themes (add|update|remove|list|help)
  dev         Start development server
  start       Start production server
  version     Show CLI / shop version
  upgrade     Upgrade bermooda-cli globally
  help        Show help for a command

${pc.bold('Global options:')}
  --cwd <path>   Working directory
  -y, --yes      Accept defaults (non-interactive)
  --json         Machine-readable output (where supported)
  --verbose      Debug logging

Run ${pc.cyan('bermooda help <command>')} for details.
`);
}
