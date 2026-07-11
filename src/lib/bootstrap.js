import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from './constants.js';
import { error, info, success, warn } from './logger.js';
import { loadShopEnv, run } from './process.js';

/**
 * Create admin user and shop name via shop-side scripts.
 *
 * Prefers scripts/cli-bootstrap.mjs when present; falls back to npm run seed.
 *
 * @param {string} shopRoot
 * @param {{
 *   adminEmail: string,
 *   adminPassword: string,
 *   storeName: string,
 *   minimal?: boolean,
 * }} opts
 */
export async function bootstrapShop(shopRoot, opts) {
  const env = {
    ...loadShopEnv(shopRoot),
    SEED_ADMIN_EMAIL: opts.adminEmail,
    SEED_ADMIN_PASSWORD: opts.adminPassword,
    SEED_SHOP_NAME: opts.storeName,
  };
  if (opts.minimal) {
    env.BERMOODA_MINIMAL_SEED = '1';
  }

  const cliBootstrap = join(shopRoot, 'scripts', 'cli-bootstrap.mjs');
  if (existsSync(cliBootstrap)) {
    info('Running shop CLI bootstrap…');
    const code = await run('node', [cliBootstrap], { cwd: shopRoot, env });
    if (code !== 0) {
      error('CLI bootstrap failed');
      process.exit(EXIT.DB);
    }
    success('Admin user and store configured');
    return;
  }

  info('Running npm run seed (admin via SEED_ADMIN_*)…');
  const code = await run('npm', ['run', 'seed'], { cwd: shopRoot, env });
  if (code !== 0) {
    error(
      'Seed failed. Ensure the shop supports SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, or add scripts/cli-bootstrap.mjs (see DESIGN.md PR-A1).'
    );
    process.exit(EXIT.DB);
  }
  success(`Admin user seeded (${opts.adminEmail})`);
  if (opts.storeName) {
    warn(
      `Store name "${opts.storeName}" may need to be set in Admin → Settings until scripts/cli-bootstrap.mjs lands in the app (SEED_SHOP_NAME).`
    );
  }
}
