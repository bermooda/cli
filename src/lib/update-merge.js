import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { PROJECT_JSON } from './constants.js';
import { assertInside } from './fs-install.js';
import { debug, info, warn } from './logger.js';
import { getCliVersion } from './package-json.js';

/**
 * Core paths copied from a new app release into a non-git shop.
 * User data and secrets are never in this list.
 */
export const UPDATE_CORE_PATHS = [
  'app/core',
  'app/routes',
  'app/routes.js',
  'app/components',
  'app/libs',
  'app/emails',
  'app/hooks',
  'app/utils',
  'app/styles',
  'app/root.jsx',
  'app/entry.server.jsx',
  'app/config.js',
  'app/test-setup.js',
  'prisma/schema.prisma',
  'prisma/migrations',
  'prisma/seed.js',
  'prisma.config.js',
  'scripts',
  'public',
  'package.json',
  'package-lock.json',
  'react-router.config.js',
  'vite.config.js',
  'vitest.config.js',
  'tsconfig.json',
  'Dockerfile',
  'fly.toml',
  'LICENSE',
];

/**
 * Paths that must never be overwritten by tarball merge.
 */
export const UPDATE_PRESERVE = [
  '.env',
  '.env.local',
  '.bermooda',
  'node_modules',
  'build',
  '.git',
];

/**
 * @param {string} shopRoot
 * @param {string} releaseRoot
 * @param {{ sourceRef: string, dryRun?: boolean }} opts
 * @returns {{ copied: string[], skipped: string[], preservedPlugins: string[], preservedThemes: string[] }}
 */
export function mergeAppRelease(shopRoot, releaseRoot, opts) {
  const copied = [];
  const skipped = [];
  const dryRun = Boolean(opts.dryRun);

  for (const rel of UPDATE_CORE_PATHS) {
    const from = join(releaseRoot, rel);
    const to = join(shopRoot, rel);
    if (!existsSync(from)) {
      skipped.push(rel);
      continue;
    }
    assertInside(shopRoot, to);
    if (!dryRun) {
      if (statSync(from).isDirectory()) {
        // Replace directory contents for core trees
        if (existsSync(to)) {
          rmSync(to, { recursive: true, force: true });
        }
        mkdirSync(dirname(to), { recursive: true });
        cpSync(from, to, { recursive: true });
      } else {
        mkdirSync(dirname(to), { recursive: true });
        cpSync(from, to);
      }
    }
    copied.push(rel);
    debug(`merge: ${rel}`);
  }

  // Merge bundled plugins/themes without deleting user-only packages
  const preservedPlugins = mergeExtensionDir(
    shopRoot,
    releaseRoot,
    'app/plugins',
    dryRun
  );
  const preservedThemes = mergeExtensionDir(
    shopRoot,
    releaseRoot,
    'app/themes',
    dryRun
  );

  // Never touch DB files under prisma/
  if (!dryRun) {
    updateProjectMeta(shopRoot, opts.sourceRef);
  }

  info(
    `Merged ${copied.length} core path(s); preserved plugins=[${preservedPlugins.join(', ') || 'none'}] themes=[${preservedThemes.join(', ') || 'none'}]`
  );

  return { copied, skipped, preservedPlugins, preservedThemes };
}

/**
 * Copy packages present in the release; leave shop-only packages alone.
 * @param {string} shopRoot
 * @param {string} releaseRoot
 * @param {string} relDir e.g. app/plugins
 * @param {boolean} dryRun
 * @returns {string[]} ids that exist only in the shop (preserved)
 */
function mergeExtensionDir(shopRoot, releaseRoot, relDir, dryRun) {
  const releaseDir = join(releaseRoot, relDir);
  const shopDir = join(shopRoot, relDir);
  const releaseIds = listDirNames(releaseDir);
  const shopIds = listDirNames(shopDir);
  const preserved = shopIds.filter((id) => !releaseIds.includes(id));

  for (const id of releaseIds) {
    const from = join(releaseDir, id);
    const to = join(shopDir, id);
    assertInside(shopRoot, to);
    if (!dryRun) {
      if (existsSync(to)) {
        rmSync(to, { recursive: true, force: true });
      }
      mkdirSync(shopDir, { recursive: true });
      cpSync(from, to, { recursive: true });
    }
  }

  if (preserved.length) {
    warn(
      `Preserved shop-only packages under ${relDir}: ${preserved.join(', ')}`
    );
  }
  return preserved;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listDirNames(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    if (name.startsWith('.')) return false;
    try {
      return statSync(join(dir, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * @param {string} shopRoot
 * @param {string} sourceRef
 */
function updateProjectMeta(shopRoot, sourceRef) {
  const path = join(shopRoot, PROJECT_JSON);
  let meta = {};
  if (existsSync(path)) {
    try {
      meta = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta.sourceRef = sourceRef;
  meta.updatedAt = new Date().toISOString();
  meta.cliVersion = getCliVersion();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

/**
 * Resolve a path and ensure it cannot escape shopRoot (defense in depth).
 * @param {string} shopRoot
 * @param {string} candidate
 */
export function safeShopPath(shopRoot, candidate) {
  const base = resolve(shopRoot) + sep;
  const target = resolve(shopRoot, candidate);
  if (target !== resolve(shopRoot) && !target.startsWith(base)) {
    throw new Error(`Path escapes shop root: ${candidate}`);
  }
  return target;
}

/**
 * Relative path helper for tests.
 * @param {string} from
 * @param {string} to
 */
export function relPath(from, to) {
  return relative(from, to);
}
