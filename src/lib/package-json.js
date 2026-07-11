import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to this CLI package root.
 * @returns {string}
 */
export function getCliPackageRoot() {
  return join(__dirname, '../..');
}

/**
 * @returns {{ name: string, version: string }}
 */
export function getCliPackageJson() {
  const raw = readFileSync(join(getCliPackageRoot(), 'package.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * @returns {string}
 */
export function getCliVersion() {
  return getCliPackageJson().version;
}

/**
 * @param {string} dir
 * @returns {object | null}
 */
export function readPackageJson(dir) {
  const path = join(dir, 'package.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Merge dependency maps into a shop package.json and write back.
 * @param {string} shopRoot
 * @param {Record<string, string>} deps
 * @param {'dependencies' | 'devDependencies'} [field]
 */
export function mergeDependencies(shopRoot, deps, field = 'dependencies') {
  const pkg = readPackageJson(shopRoot);
  if (!pkg) {
    throw new Error(`No package.json in ${shopRoot}`);
  }
  pkg[field] = { ...(pkg[field] ?? {}), ...deps };
  writeFileSync(
    join(shopRoot, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8'
  );
}
