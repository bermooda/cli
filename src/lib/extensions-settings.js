import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from './constants.js';
import { error, warn } from './logger.js';
import { loadShopEnv, run } from './process.js';

/**
 * Write activeTheme and/or enabledPlugins to shop settings via cli-set-extensions.mjs.
 *
 * Env vars forwarded to the shop script:
 *   BERMOODA_ACTIVE_THEME    — full package id (replaces setting)
 *   BERMOODA_ENABLED_PLUGINS — comma-separated ids (full replace)
 *   BERMOODA_ENABLE_PLUGIN   — single id to append if not already present
 *
 * If scripts/cli-set-extensions.mjs is absent the function warns and returns
 * without error so partial-app setups don't hard-fail.
 *
 * @param {string} shopRoot
 * @param {{
 *   activeTheme?: string,
 *   enabledPlugins?: string[],
 *   enablePlugin?: string,
 * }} opts
 */
export async function setShopExtensions(shopRoot, opts) {
  const { activeTheme, enabledPlugins, enablePlugin } = opts;
  const scriptPath = join(shopRoot, 'scripts', 'cli-set-extensions.mjs');

  if (!existsSync(scriptPath)) {
    warn(
      'scripts/cli-set-extensions.mjs not found — skipping extension settings write.\n' +
        '  Enable extensions manually in Admin → Themes / Plugins after first run.'
    );
    return;
  }

  /** @type {Record<string, string>} */
  const env = { ...loadShopEnv(shopRoot) };
  if (activeTheme) env.BERMOODA_ACTIVE_THEME = activeTheme;
  if (enabledPlugins) env.BERMOODA_ENABLED_PLUGINS = enabledPlugins.join(',');
  if (enablePlugin) env.BERMOODA_ENABLE_PLUGIN = enablePlugin;

  const code = await run('node', [scriptPath], { cwd: shopRoot, env });
  if (code !== 0) {
    error(
      'cli-set-extensions.mjs exited with a non-zero code — extension settings were not updated.'
    );
    process.exit(EXIT.USER);
  }
}
