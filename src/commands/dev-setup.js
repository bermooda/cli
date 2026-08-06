import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';

import { writeBermoodaConfig } from '../lib/bermooda-config.js';
import { bootstrapShop } from '../lib/bootstrap.js';
import {
  APP_REPO,
  APP_REPO_SLUG,
  CONTRIBUTOR_EXTENSIONS,
  EXIT,
  PROJECT_JSON,
} from '../lib/constants.js';
import { setupDatabase } from '../lib/db.js';
import {
  buildEnvFile,
  defaultEnvOverrides,
  readEnvExample,
  writeEnvFile,
} from '../lib/env.js';
import { installExtensionLocalDependencies } from '../lib/extension-source.js';
import { setShopExtensions } from '../lib/extensions-settings.js';
import { gitClone } from '../lib/git-clone.js';
import { error, info, success } from '../lib/logger.js';
import { getCliVersion } from '../lib/package-json.js';
import { loadShopEnv, npm } from '../lib/process.js';
import {
  passwordOrFail,
  selectOrDefault,
  textOrDefault,
} from '../lib/prompts.js';

/** Default from-address used with --yes / non-interactive dev-setup. */
export const DEFAULT_FROM_NO_REPLY = 'bermooda <noreply@example.com>';

/**
 * Contributor setup: full-clone the app + default extensions as nested git
 * repos, then bootstrap deps / env / DB / admin / extension settings.
 *
 * @param {Record<string, any>} args
 */
export async function devSetupCommand(args = {}) {
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
    if (entries.length > 0) {
      if (!args.force) {
        error(
          `Target directory is not empty: ${targetDir}\nPass --force to replace it (destructive).`
        );
        process.exit(EXIT.USER);
      }
      rmSync(targetDir, { recursive: true, force: true });
    }
  }

  p.intro('bermooda dev-setup');

  await gitClone({
    url: APP_REPO,
    dest: targetDir,
    ref: args.ref,
    label: APP_REPO_SLUG,
  });
  success(`App cloned (${APP_REPO_SLUG}${args.ref ? `@${args.ref}` : ''})`);

  mkdirSync(resolve(targetDir, '.bermooda'), { recursive: true });
  writeFileSync(
    resolve(targetDir, PROJECT_JSON),
    `${JSON.stringify(
      {
        cliVersion: getCliVersion(),
        installedAt: new Date().toISOString(),
        installMode: mode,
        sourceRef: args.ref ?? 'HEAD',
        appRepo: APP_REPO_SLUG,
        method: 'dev-setup',
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  info('Cloning default theme and plugins…');
  for (const ext of CONTRIBUTOR_EXTENSIONS) {
    const destRoot =
      ext.kind === 'plugin'
        ? join(targetDir, 'app', 'plugins', ext.slug)
        : join(targetDir, 'app', 'themes', ext.slug);
    await gitClone({
      url: ext.repo,
      dest: destRoot,
      label: ext.packageId,
    });
    success(`Cloned ${ext.packageId} → ${ext.kind}s/${ext.slug}`);
  }

  if (!args.skipDeps) {
    info('Installing npm dependencies…');
    const code = await npm(targetDir, ['install']);
    if (code !== 0) {
      error('npm install failed');
      process.exit(EXIT.DEPS);
    }
    success('Dependencies installed');

    for (const ext of CONTRIBUTOR_EXTENSIONS) {
      const destRoot =
        ext.kind === 'plugin'
          ? join(targetDir, 'app', 'plugins', ext.slug)
          : join(targetDir, 'app', 'themes', ext.slug);
      await installExtensionLocalDependencies(destRoot);
    }
  }

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

  let fromNoReply = args.fromEmail;
  if (!fromNoReply) {
    if (yes || !interactive) {
      fromNoReply = DEFAULT_FROM_NO_REPLY;
      info(`Using default from email ${fromNoReply}`);
    } else {
      fromNoReply = await textOrDefault(
        ctx,
        'From email for transactional mail (fromNoReply)',
        DEFAULT_FROM_NO_REPLY
      );
    }
  }
  fromNoReply = String(fromNoReply).trim();
  if (!fromNoReply) {
    error('fromNoReply / --from-email is required');
    process.exit(EXIT.USER);
  }

  const overrides = defaultEnvOverrides(mode, {
    databaseUrl:
      databaseUrl ?? (db === 'sqlite' ? 'file:./prisma/dev.db' : undefined),
    databaseProvider: db === 'postgresql' ? 'postgresql' : undefined,
  });

  if (interactive && !yes) {
    info(
      'Optional integrations: press Enter to leave placeholders from .env.example'
    );
  }

  const example = readEnvExample(targetDir);
  const envContent = buildEnvFile(example, overrides);
  writeEnvFile(targetDir, envContent, { force: Boolean(args.forceEnv) });

  // Dev setup omits baseUrl so `#/libs/config` uses the localhost auto-URL.
  writeBermoodaConfig(targetDir, { fromNoReply });
  success('Wrote bermooda.config.js');

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

    const themeExt = CONTRIBUTOR_EXTENSIONS.find((e) => e.kind === 'theme');
    const pluginIds = CONTRIBUTOR_EXTENSIONS.filter(
      (e) => e.kind === 'plugin'
    ).map((e) => e.packageId);

    await setShopExtensions(targetDir, {
      activeTheme: themeExt?.packageId,
      enabledPlugins: pluginIds,
    });
  }

  void loadShopEnv(targetDir);

  p.outro(`Contributor shop ready at ${targetDir}

Nested git checkouts:
  app/themes/default
  app/plugins/meilisearch
  app/plugins/resend

Next steps:
  cd ${targetDir}
  bermooda dev
  bermooda mcp init

Admin: ${adminEmail}
`);
}
