import semver from 'semver';

import { EXIT } from './constants.js';
import { error } from './logger.js';

/**
 * @typedef {{
 *   shopVersion: string | null | undefined,
 *   engine: unknown,
 *   kind: 'plugin' | 'theme',
 *   id: string,
 * }} EngineCompatibilityOpts
 */

/**
 * Check whether a shop version satisfies an extension's required
 * `bermooda.engine` semver range.
 * @param {EngineCompatibilityOpts} opts
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function evaluateEngineCompatibility(opts) {
  const { shopVersion, engine, kind, id } = opts;
  const label = kind === 'theme' ? 'Theme' : 'Plugin';

  if (!shopVersion || !semver.valid(shopVersion)) {
    return {
      ok: false,
      message: 'Shop package.json must declare a valid semver "version"',
    };
  }

  if (!engine || typeof engine !== 'string' || !semver.validRange(engine)) {
    return {
      ok: false,
      message: `${label} "${id}" must declare a valid semver range in "bermooda.engine"`,
    };
  }

  if (!semver.satisfies(shopVersion, engine)) {
    return {
      ok: false,
      message: `${label} "${id}" requires bermooda ${engine} (shop is ${shopVersion})`,
    };
  }

  return { ok: true };
}

/**
 * Evaluate engine compatibility and hard-fail the process on mismatch.
 * @param {EngineCompatibilityOpts} opts
 */
export function assertEngineCompatible(opts) {
  const result = evaluateEngineCompatibility(opts);
  if (!result.ok) {
    error(result.message);
    process.exit(EXIT.USER);
  }
}
