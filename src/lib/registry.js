import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_REGISTRY_URL, EXIT, SAFE_ID_RE } from './constants.js';
import { debug, error, warn } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {object} RegistryVersion
 * @property {string} [tarball]
 * @property {string} [integrity]
 * @property {string} [minBermoodaVersion]
 * @property {string} [repo]
 */

/**
 * @typedef {object} RegistryPackage
 * @property {string} name
 * @property {string} id
 * @property {'plugin' | 'theme'} type
 * @property {string} [description]
 * @property {Record<string, RegistryVersion>} versions
 * @property {string} latest
 */

/**
 * @returns {Promise<{ schemaVersion: number, packages: RegistryPackage[] }>}
 */
export async function loadRegistry() {
  const builtinPath = join(__dirname, '../data/builtin-registry.json');
  let builtin;
  try {
    builtin = JSON.parse(readFileSync(builtinPath, 'utf8'));
  } catch {
    builtin = { schemaVersion: 1, packages: [] };
  }

  try {
    debug(`Fetching registry ${DEFAULT_REGISTRY_URL}`);
    const res = await fetch(DEFAULT_REGISTRY_URL, {
      headers: { 'User-Agent': '@bermooda/cli' },
    });
    if (!res.ok) {
      warn(`Registry unavailable (${res.status}); using builtin registry`);
      return builtin;
    }
    const remote = await res.json();
    return mergeRegistries(builtin, remote);
  } catch {
    warn('Registry fetch failed; using builtin registry');
    return builtin;
  }
}

/**
 * @param {{ packages: RegistryPackage[] }} a
 * @param {{ packages: RegistryPackage[] }} b
 */
function mergeRegistries(a, b) {
  const map = new Map();
  for (const pkg of a.packages ?? []) {
    map.set(`${pkg.type}:${pkg.id}`, pkg);
  }
  for (const pkg of b.packages ?? []) {
    map.set(`${pkg.type}:${pkg.id}`, pkg);
  }
  return {
    schemaVersion: b.schemaVersion ?? a.schemaVersion ?? 1,
    packages: [...map.values()],
  };
}

/**
 * Resolve a package from a registry object (exported for unit tests).
 * @param {{ packages: RegistryPackage[] }} registry
 * @param {'plugin' | 'theme'} type
 * @param {string} nameOrId
 * @param {string} [version]
 * @returns {{ pkg: RegistryPackage, version: string, meta: RegistryVersion }}
 */
export function resolvePackageFromRegistry(registry, type, nameOrId, version) {
  const pkg = registry.packages.find(
    (p) => p.type === type && (p.id === nameOrId || p.name === nameOrId)
  );
  if (!pkg) {
    const err = new Error(
      `Unknown ${type} "${nameOrId}". Use --path, --git, or --tarball, or add it to the registry.`
    );
    /** @type {any} */ (err).exitCode = EXIT.USER;
    throw err;
  }
  if (!SAFE_ID_RE.test(pkg.id)) {
    const err = new Error(
      `Invalid ${type} id "${pkg.id}" (must match ${SAFE_ID_RE})`
    );
    /** @type {any} */ (err).exitCode = EXIT.USER;
    throw err;
  }
  const ver = version ?? pkg.latest;
  const meta = pkg.versions?.[ver];
  if (!meta) {
    const err = new Error(`Version ${ver} not found for ${type} ${pkg.id}`);
    /** @type {any} */ (err).exitCode = EXIT.USER;
    throw err;
  }
  if (meta.tarball && !String(meta.tarball).startsWith('https://')) {
    const err = new Error(
      `Registry tarball for ${pkg.id}@${ver} must be HTTPS`
    );
    /** @type {any} */ (err).exitCode = EXIT.NETWORK;
    throw err;
  }
  return { pkg, version: ver, meta };
}

/**
 * @param {'plugin' | 'theme'} type
 * @param {string} nameOrId
 * @param {string} [version]
 */
export async function resolvePackage(type, nameOrId, version) {
  const registry = await loadRegistry();
  try {
    return resolvePackageFromRegistry(registry, type, nameOrId, version);
  } catch (err) {
    error(/** @type {Error} */ (err).message);
    process.exit(/** @type {any} */ (err).exitCode ?? EXIT.USER);
  }
}
