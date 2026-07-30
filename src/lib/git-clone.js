import { EXIT } from './constants.js';
import { error, info } from './logger.js';
import { run } from './process.js';

/**
 * Full `git clone` into `dest` (no shallow depth).
 *
 * Caller must ensure `dest` does not exist or is empty — git refuses
 * non-empty destinations.
 *
 * @param {{
 *   url: string,
 *   dest: string,
 *   ref?: string,
 *   label?: string,
 * }} opts
 * @returns {Promise<void>}
 */
export async function gitClone(opts) {
  const { url, dest, ref, label } = opts;
  const display = label ?? url;

  const versionCode = await run('git', ['--version'], { silent: true });
  if (versionCode !== 0) {
    error(
      'git is required for bermooda dev-setup but was not found on PATH.\n' +
        'Install git, then re-run this command.'
    );
    process.exit(EXIT.USER);
  }

  const gitArgs = ['clone'];
  if (ref) {
    gitArgs.push('--branch', ref);
  }
  gitArgs.push(url, dest);

  info(`Cloning ${display}${ref ? `@${ref}` : ''}…`);
  const code = await run('git', gitArgs);
  if (code !== 0) {
    error(
      `git clone failed for ${display}` +
        (ref ? ` (ref ${ref})` : '') +
        `\n  ${url} → ${dest}`
    );
    process.exit(EXIT.NETWORK);
  }
}
