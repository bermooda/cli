import { EXIT } from '../lib/constants.js';
import { error, info, success } from '../lib/logger.js';
import { detectPackageManager, run } from '../lib/process.js';

/**
 * Upgrade the CLI package globally.
 */
export async function upgradeCommand() {
  const pm = detectPackageManager();
  info(`Upgrading @bermooda/cli with ${pm}…`);

  /** @type {string[]} */
  let args;
  if (pm === 'pnpm') {
    args = ['add', '-g', '@bermooda/cli@latest'];
  } else if (pm === 'yarn') {
    args = ['global', 'add', '@bermooda/cli@latest'];
  } else {
    args = ['install', '-g', '@bermooda/cli@latest'];
  }

  const code = await run(pm, args);
  if (code !== 0) {
    error(`Global upgrade failed. Try manually: ${pm} ${args.join(' ')}`);
    process.exit(EXIT.DEPS);
  }
  success('@bermooda/cli upgraded to latest');
}
