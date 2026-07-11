import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from '../lib/constants.js';
import { info, warn } from '../lib/logger.js';
import { loadShopEnv, run } from '../lib/process.js';
import { assertInShop } from '../lib/project.js';

/**
 * @param {{ cwd?: string, build?: boolean }} args
 */
export async function startCommand(args = {}) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const env = loadShopEnv(shopRoot);
  const serverEntry = join(shopRoot, 'build', 'server', 'index.js');

  if (!existsSync(serverEntry)) {
    warn('Production build not found; running npm run build…');
    const buildCode = await run('npm', ['run', 'build'], {
      cwd: shopRoot,
      env,
    });
    if (buildCode !== 0) {
      process.exit(buildCode);
    }
  }

  info(`Starting production server in ${shopRoot}…`);
  const code = await run('npm', ['run', 'start'], { cwd: shopRoot, env });
  process.exit(code === 130 ? EXIT.SIGINT : code);
}
