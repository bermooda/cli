#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';

import { devCommand } from './commands/dev.js';
import { helpCommand } from './commands/help.js';
import { installCommand } from './commands/install.js';
import { mcpInit } from './commands/mcp/init.js';
import {
  pluginAdd,
  pluginHelp,
  pluginList,
  pluginRemove,
  pluginUpdate,
} from './commands/plugin/index.js';
import { startCommand } from './commands/start.js';
import {
  themeAdd,
  themeHelp,
  themeList,
  themeRemove,
  themeUpdate,
} from './commands/theme/index.js';
import { updateCommand } from './commands/update.js';
import { upgradeCommand } from './commands/upgrade.js';
import { versionCommand } from './commands/version.js';
import { EXIT } from './lib/constants.js';
import { errorFrom, setVerbose } from './lib/logger.js';

const globalArgs = {
  cwd: {
    type: 'string',
    description: 'Working directory',
  },
  yes: {
    type: 'boolean',
    description: 'Accept defaults / non-interactive',
    alias: 'y',
    default: false,
  },
  json: {
    type: 'boolean',
    description: 'JSON output where supported',
    default: false,
  },
  verbose: {
    type: 'boolean',
    description: 'Debug logging',
    default: false,
  },
};

/**
 * @param {(args: any) => Promise<void>} fn
 */
function wrap(fn) {
  return async (ctx) => {
    const args = ctx.args ?? {};
    if (args.verbose) setVerbose(true);
    try {
      await fn(args);
    } catch (err) {
      errorFrom(err);
      process.exit(EXIT.USER);
    }
  };
}

const main = defineCommand({
  meta: {
    name: 'bermooda',
    description: 'CLI for bermooda ecommerce shops',
  },
  args: globalArgs,
  subCommands: {
    install: defineCommand({
      meta: {
        name: 'install',
        description: 'Create a new shop from the bermooda app repository',
      },
      args: {
        ...globalArgs,
        local: { type: 'boolean', description: 'Local install profile' },
        server: { type: 'boolean', description: 'Server install profile' },
        dir: { type: 'string', description: 'Target directory' },
        ref: { type: 'string', description: 'App git tag or branch' },
        db: { type: 'string', description: 'sqlite | postgresql' },
        databaseUrl: { type: 'string', description: 'DATABASE_URL' },
        adminEmail: { type: 'string', description: 'Admin email' },
        adminPassword: { type: 'string', description: 'Admin password' },
        storeName: { type: 'string', description: 'Store display name' },
        skipDeps: { type: 'boolean', description: 'Skip npm install' },
        skipDb: { type: 'boolean', description: 'Skip migrate/seed' },
        force: { type: 'boolean', description: 'Allow non-empty directory' },
        forceEnv: { type: 'boolean', description: 'Overwrite .env' },
        noInteractive: {
          type: 'boolean',
          description: 'Fail if prompts would be required',
        },
        withDemo: {
          type: 'boolean',
          description: 'Include demo catalog on server install',
        },
        source: {
          type: 'string',
          description:
            'Local path to a bermooda app checkout (skip GitHub download)',
        },
      },
      run: wrap(installCommand),
    }),

    update: defineCommand({
      meta: {
        name: 'update',
        description: 'Update shop app code to latest',
      },
      args: {
        ...globalArgs,
        ref: { type: 'string', description: 'Target ref' },
        dryRun: { type: 'boolean', description: 'Plan only' },
      },
      run: wrap(updateCommand),
    }),

    upgrade: defineCommand({
      meta: {
        name: 'upgrade',
        description: 'Upgrade bermooda-cli globally',
      },
      args: globalArgs,
      run: wrap(upgradeCommand),
    }),

    dev: defineCommand({
      meta: { name: 'dev', description: 'Start development server' },
      args: {
        ...globalArgs,
        port: { type: 'string', description: 'Port (default 3000)' },
      },
      run: wrap(devCommand),
    }),

    start: defineCommand({
      meta: { name: 'start', description: 'Start production server' },
      args: globalArgs,
      run: wrap(startCommand),
    }),

    version: defineCommand({
      meta: { name: 'version', description: 'Show CLI and/or shop version' },
      args: {
        ...globalArgs,
        cli: { type: 'boolean', description: 'CLI version only' },
        shop: { type: 'boolean', description: 'Shop version only' },
      },
      run: wrap(versionCommand),
    }),

    help: defineCommand({
      meta: { name: 'help', description: 'Show help' },
      args: {
        command: {
          type: 'positional',
          description: 'Command name',
          required: false,
        },
      },
      run: wrap(helpCommand),
    }),

    plugin: defineCommand({
      meta: { name: 'plugin', description: 'Manage plugins' },
      subCommands: {
        add: defineCommand({
          meta: { name: 'add', description: 'Install a plugin' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: false },
            version: { type: 'positional', required: false },
            path: { type: 'string' },
            git: { type: 'string' },
            tarball: { type: 'string' },
            enable: { type: 'boolean', default: false },
          },
          run: wrap(pluginAdd),
        }),
        update: defineCommand({
          meta: { name: 'update', description: 'Update a plugin' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: false },
            version: { type: 'positional', required: false },
            path: { type: 'string' },
            git: { type: 'string' },
            tarball: { type: 'string' },
          },
          run: wrap(pluginUpdate),
        }),
        remove: defineCommand({
          meta: { name: 'remove', description: 'Remove a plugin' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: true },
          },
          run: wrap(pluginRemove),
        }),
        list: defineCommand({
          meta: { name: 'list', description: 'List plugins' },
          args: globalArgs,
          run: wrap(pluginList),
        }),
        help: defineCommand({
          meta: { name: 'help', description: 'Plugin help' },
          run: wrap(pluginHelp),
        }),
      },
      // No parent `run` — citty invokes parent+child run when both exist.
    }),

    theme: defineCommand({
      meta: { name: 'theme', description: 'Manage themes' },
      subCommands: {
        add: defineCommand({
          meta: { name: 'add', description: 'Install a theme' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: false },
            version: { type: 'positional', required: false },
            path: { type: 'string' },
            git: { type: 'string' },
            tarball: { type: 'string' },
            activate: { type: 'boolean', default: false },
          },
          run: wrap(themeAdd),
        }),
        update: defineCommand({
          meta: { name: 'update', description: 'Update a theme' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: false },
            version: { type: 'positional', required: false },
            path: { type: 'string' },
            git: { type: 'string' },
            tarball: { type: 'string' },
          },
          run: wrap(themeUpdate),
        }),
        remove: defineCommand({
          meta: { name: 'remove', description: 'Remove a theme' },
          args: {
            ...globalArgs,
            name: { type: 'positional', required: true },
          },
          run: wrap(themeRemove),
        }),
        list: defineCommand({
          meta: { name: 'list', description: 'List themes' },
          args: globalArgs,
          run: wrap(themeList),
        }),
        help: defineCommand({
          meta: { name: 'help', description: 'Theme help' },
          run: wrap(themeHelp),
        }),
      },
    }),

    mcp: defineCommand({
      meta: { name: 'mcp', description: 'MCP server configuration' },
      subCommands: {
        init: defineCommand({
          meta: {
            name: 'init',
            description: 'Write Cursor MCP config for this shop',
          },
          args: {
            ...globalArgs,
            url: { type: 'string', description: 'Shop URL' },
            key: { type: 'string', description: 'Admin API key (berm_*)' },
            force: {
              type: 'boolean',
              description: 'Replace invalid or existing MCP config',
            },
          },
          run: wrap(mcpInit),
        }),
      },
    }),
  },
});

// Show our help when invoked with no subcommand (citty may also print usage).
const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  await helpCommand({});
  process.exit(0);
}

runMain(main);
