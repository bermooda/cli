import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';

import { bootstrapShop } from '../lib/bootstrap.js';
import { APP_REPO_SLUG, EXIT, PROJECT_JSON } from '../lib/constants.js';
import { setupDatabase } from '../lib/db.js';
import { downloadApp } from '../lib/download.js';
import {
  buildEnvFile,
  defaultEnvOverrides,
  readEnvExample,
  writeEnvFile,
} from '../lib/env.js';
import { error, info, success } from '../lib/logger.js';
import { getCliVersion } from '../lib/package-json.js';
import { loadShopEnv, npm } from '../lib/process.js';
import {
  passwordOrFail,
  selectOrDefault,
  textOrDefault,
} from '../lib/prompts.js';

/**
 * @param {Record<string, any>} args
 */
export async function installCommand(args = {}) {
  const yes = Boolean(args.yes);
  const interactive = !args.noInteractive && process.stdin.isTTY && !yes;
  const ctx = { yes, interactive };

  if (args.local && args.server) {
    error('Pass only one of --local or --server');
    process.exit(EXIT.USER);
  }

  /** @type {'local' | 'server'} */
  let mode = args.server ? 'server' : args.local ? 'local' : 'local';
  if (!args.local && !args.server && interactive) {
    mode = /** @type {'local' | 'server'} */ (
      await selectOrDefault(
        ctx,
        'Installation type',
        [
          { value: 'local', label: 'Local development (SQLite)' },
          { value: 'server', label: 'Server / production (PostgreSQL)' },
        ],
        'local'
      )
    );
  }

  const dirInput =
    args.dir ?? (await textOrDefault(ctx, 'Project directory', './bermooda'));
  const targetDir = resolve(args.cwd ?? process.cwd(), dirInput);

  if (existsSync(targetDir)) {
    const entries = readdirSync(targetDir);
    if (entries.length > 0 && !args.force) {
      error(
        `Target directory is not empty: ${targetDir}\nPass --force to install anyway (destructive).`
      );
      process.exit(EXIT.USER);
    }
  } else {
    mkdirSync(targetDir, { recursive: true });
  }

  p.intro('bermooda install');

  const sourcePath = args.source
    ? resolve(args.cwd ?? process.cwd(), args.source)
    : undefined;

  const { sourceRef, method } = await downloadApp({
    targetDir,
    ref: args.ref,
    source: sourcePath,
  });
  success(`App source ready (${method}, ref ${sourceRef})`);

  // Project marker
  mkdirSync(resolve(targetDir, '.bermooda'), { recursive: true });
  writeFileSync(
    resolve(targetDir, PROJECT_JSON),
    `${JSON.stringify(
      {
        cliVersion: getCliVersion(),
        installedAt: new Date().toISOString(),
        installMode: mode,
        sourceRef,
        appRepo: APP_REPO_SLUG,
        method,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  if (!args.skipDeps) {
    info('Installing npm dependencies…');
    const code = await npm(targetDir, ['install']);
    if (code !== 0) {
      error('npm install failed');
      process.exit(EXIT.DEPS);
    }
    success('Dependencies installed');
  }

  // Database choice
  /** @type {'sqlite' | 'postgresql'} */
  let db = args.db ?? (mode === 'server' ? 'postgresql' : 'sqlite');
  if (!args.db && interactive) {
    db = /** @type {'sqlite' | 'postgresql'} */ (
      await selectOrDefault(
        ctx,
        'Database',
        [
          { value: 'sqlite', label: 'SQLite (local file)' },
          { value: 'postgresql', label: 'PostgreSQL' },
        ],
        db
      )
    );
  }

  let databaseUrl = args.databaseUrl;
  if (db === 'postgresql' && !databaseUrl) {
    databaseUrl = await textOrDefault(ctx, 'PostgreSQL DATABASE_URL', '');
    if (!databaseUrl) {
      error('DATABASE_URL is required for PostgreSQL');
      process.exit(EXIT.USER);
    }
  }

  const adminEmail =
    args.adminEmail ??
    (await textOrDefault(ctx, 'Admin email', 'admin@bermooda.dev'));
  let adminPassword = args.adminPassword;
  if (!adminPassword) {
    if (yes) {
      adminPassword = 'changeme123!';
      info('Using default admin password (set --admin-password in production)');
    } else {
      adminPassword = await passwordOrFail(ctx, 'Admin password');
    }
  }
  const storeName =
    args.storeName ?? (await textOrDefault(ctx, 'Store name', 'My Store'));

  const overrides = defaultEnvOverrides(mode, {
    databaseUrl:
      databaseUrl ?? (db === 'sqlite' ? 'file:./prisma/dev.db' : undefined),
    databaseProvider: db === 'postgresql' ? 'postgresql' : undefined,
  });

  // Optional integrations skipped when --yes
  if (interactive && !yes) {
    info(
      'Optional integrations: press Enter to leave placeholders from .env.example'
    );
  }

  const example = readEnvExample(targetDir);
  const envContent = buildEnvFile(example, overrides);
  writeEnvFile(targetDir, envContent, { force: Boolean(args.forceEnv) });

  if (!args.skipDb) {
    await setupDatabase(targetDir, {
      provider: db === 'postgresql' ? 'postgresql' : 'sqlite',
    });
    await bootstrapShop(targetDir, {
      adminEmail,
      adminPassword,
      storeName,
      minimal: mode === 'server' && !args.withDemo,
    });
  }

  // Touch env load path for next steps message
  void loadShopEnv(targetDir);

  p.outro(`Shop ready at ${targetDir}

Next steps:
  cd ${targetDir}
  bermooda dev

Admin: ${adminEmail}
`);
}
