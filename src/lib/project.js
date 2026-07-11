import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { BERMOODA_DIR, EXIT, PROJECT_JSON } from './constants.js';
import { error } from './logger.js';
import { readPackageJson } from './package-json.js';

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function isShopRoot(dir) {
  const pkg = readPackageJson(dir);
  if (!pkg || pkg.name !== 'bermooda') return false;
  if (!existsSync(join(dir, 'app', 'core'))) return false;
  if (!existsSync(join(dir, 'prisma', 'schema.prisma'))) return false;
  return true;
}

/**
 * Walk up from startDir looking for a bermooda shop root.
 * @param {string} [startDir]
 * @returns {string | null}
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  while (true) {
    if (isShopRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * @param {string} [startDir]
 * @returns {string}
 */
export function assertInShop(startDir = process.cwd()) {
  const root = findProjectRoot(startDir);
  if (!root) {
    error(
      'Not inside a bermooda shop. Run this from a shop directory (package.json name "bermooda" with app/core and prisma/schema.prisma), or run `bermooda install` first.'
    );
    process.exit(EXIT.USER);
  }
  return root;
}

/**
 * @param {string} shopRoot
 * @returns {object | null}
 */
export function readProjectMeta(shopRoot) {
  const path = join(shopRoot, PROJECT_JSON);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} shopRoot
 * @returns {string}
 */
export function shopMetaDir(shopRoot) {
  return join(shopRoot, BERMOODA_DIR);
}
