import { EXIT } from '../lib/constants.js';
import { info } from '../lib/logger.js';
import { loadShopEnv, run } from '../lib/process.js';
import { assertInShop } from '../lib/project.js';

/**
 * @param {{ cwd?: string, port?: string | number }} args
 */
export async function devCommand(args = {}) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const env = loadShopEnv(shopRoot);
  const port = String(args.port ?? process.env.PORT ?? '3000');

  info(`Starting dev server in ${shopRoot} (port ${port})…`);
  // Do not use `npm run dev` — it wraps 1Password `op run`.
  const code = await run(
    'npx',
    ['react-router', 'dev', '--port', port, '--host'],
    { cwd: shopRoot, env }
  );
  process.exit(code === 130 ? EXIT.SIGINT : code);
}
