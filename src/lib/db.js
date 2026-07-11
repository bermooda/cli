import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from './constants.js';
import { error, info, success } from './logger.js';
import { loadShopEnv, run } from './process.js';

/**
 * Sync prisma provider + generate + migrate deploy.
 * @param {string} shopRoot
 * @param {{ provider?: 'sqlite' | 'postgresql' }} [opts]
 */
export async function setupDatabase(shopRoot, opts = {}) {
  const env = loadShopEnv(shopRoot);
  if (opts.provider === 'postgresql') {
    env.DATABASE_PROVIDER = 'postgresql';
  }

  const syncScript = join(shopRoot, 'scripts', 'sync-prisma-provider.js');
  if (
    existsSync(syncScript) &&
    (opts.provider === 'postgresql' || env.DATABASE_PROVIDER === 'postgresql')
  ) {
    info('Syncing Prisma provider for PostgreSQL…');
    const code = await run('node', [syncScript], { cwd: shopRoot, env });
    if (code !== 0) {
      error('Failed to sync Prisma provider');
      process.exit(EXIT.DB);
    }
  }

  info('Running prisma generate + migrate deploy…');
  const setupCode = await run('npm', ['run', 'setup'], { cwd: shopRoot, env });
  if (setupCode !== 0) {
    // Fallback if setup script missing
    const gen = await run('npx', ['prisma', 'generate'], {
      cwd: shopRoot,
      env,
    });
    if (gen !== 0) {
      error('prisma generate failed');
      process.exit(EXIT.DB);
    }
    const mig = await run('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: shopRoot,
      env,
    });
    if (mig !== 0) {
      error('prisma migrate deploy failed');
      process.exit(EXIT.DB);
    }
  }
  success('Database ready');
}
