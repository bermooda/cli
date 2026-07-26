import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { EXIT } from './constants.js';
import {
  detectPackageId,
  extractTarball,
  installFromPath,
} from './fs-install.js';
import { error, info } from './logger.js';
import {
  buildNpmSpecifier,
  downloadNpmPackage,
  hasEmbeddedVersion,
  isNpmPackageName,
} from './npm-pack.js';
import { mergeDependencies, readPackageJson } from './package-json.js';
import { npm, run } from './process.js';
import { loadRegistry, resolvePackageFromRegistry } from './registry.js';

/**
 * @typedef {{
 *   sourceDir: string,
 *   id: string,
 *   cleanup?: string,
 * }} ResolvedExtensionSource
 */

/**
 * Resolve a plugin/theme source from npm (default), registry, or alternate flags.
 * @param {{
 *   kind: 'plugin' | 'theme',
 *   name?: string,
 *   version?: string,
 *   path?: string,
 *   git?: string,
 *   tarball?: string,
 * }} args
 * @returns {Promise<ResolvedExtensionSource>}
 */
export async function resolveExtensionSource(args) {
  const { kind, name, version, path, git, tarball } = args;

  if (path) {
    const sourceDir = resolve(path);
    return {
      sourceDir,
      id: name ?? detectPackageId(sourceDir, kind),
    };
  }

  if (git) {
    const tmp = join(tmpdir(), `bermooda-${kind}-git-${Date.now()}`);
    const [url, gitRef] = String(git).split('#');
    const gitArgs = ['clone', '--depth', '1'];
    if (gitRef) gitArgs.push('--branch', gitRef);
    gitArgs.push(url, tmp);
    const code = await run('git', gitArgs);
    if (code !== 0) {
      error(`git clone failed for ${kind}`);
      process.exit(EXIT.NETWORK);
    }
    return {
      sourceDir: tmp,
      id: name ?? detectPackageId(tmp, kind),
      cleanup: tmp,
    };
  }

  if (tarball) {
    const extractParent = join(tmpdir(), `bermooda-${kind}-tar-${Date.now()}`);
    const sourceDir = await extractTarball(tarball, extractParent);
    return {
      sourceDir,
      id: name ?? detectPackageId(sourceDir, kind),
      cleanup: extractParent,
    };
  }

  if (!name) {
    error(
      `Usage: bermooda ${kind} add <npm-package> [version]\n` +
        `  Example: bermooda ${kind} add @bermooda/${kind === 'theme' ? 'theme-paper' : 'plugin-subscriptions'}`
    );
    process.exit(EXIT.USER);
  }

  // Default: npm package name (official + third-party)
  if (isNpmPackageName(name)) {
    const spec = buildNpmSpecifier(name, version);
    try {
      const downloaded = await downloadNpmPackage(spec);
      return {
        sourceDir: downloaded.sourceDir,
        id: detectPackageId(downloaded.sourceDir, kind),
        cleanup: downloaded.cleanup,
      };
    } catch (npmErr) {
      // Fall back to the bermooda registry for short ids / display names
      const registryName = hasEmbeddedVersion(name)
        ? stripEmbeddedVersion(name)
        : name;
      const registryVersion = hasEmbeddedVersion(name)
        ? embeddedVersion(name)
        : version;
      try {
        const registry = await loadRegistry();
        const {
          pkg,
          version: ver,
          meta,
        } = resolvePackageFromRegistry(
          registry,
          kind,
          registryName,
          registryVersion
        );
        if (!meta.tarball) {
          error(`Registry entry for ${pkg.id}@${ver} has no tarball URL`);
          process.exit(EXIT.USER);
        }
        info(
          `npm package "${spec}" not found; installing from bermooda registry`
        );
        const extractParent = join(
          tmpdir(),
          `bermooda-${kind}-reg-${Date.now()}`
        );
        const sourceDir = await extractTarball(meta.tarball, extractParent);
        return {
          sourceDir,
          id: pkg.id,
          cleanup: extractParent,
        };
      } catch {
        error(/** @type {Error} */ (npmErr).message);
        error(
          `Could not resolve ${kind} "${name}" from npm or the bermooda registry.\n` +
            `Use a published npm package (e.g. @bermooda/${kind}-*), or --path / --git / --tarball.`
        );
        process.exit(/** @type {any} */ (npmErr).exitCode ?? EXIT.NETWORK);
      }
    }
  }

  error(`Invalid ${kind} package name: ${name}`);
  process.exit(EXIT.USER);
}

/**
 * @param {string} name
 */
function stripEmbeddedVersion(name) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    const at = name.indexOf('@', slash);
    return at === -1 ? name : name.slice(0, at);
  }
  const at = name.indexOf('@');
  return at === -1 ? name : name.slice(0, at);
}

/**
 * @param {string} name
 */
function embeddedVersion(name) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    const at = name.indexOf('@', slash);
    return at === -1 ? undefined : name.slice(at + 1);
  }
  const at = name.indexOf('@');
  return at === -1 ? undefined : name.slice(at + 1);
}

/**
 * Install a resolved extension into the shop and merge peer/extra deps.
 * @param {{
 *   shopRoot: string,
 *   kind: 'plugin' | 'theme',
 *   source: ResolvedExtensionSource,
 *   replace?: boolean,
 *   skipDeps?: boolean,
 * }} opts
 */
export async function installExtension(opts) {
  const { shopRoot, kind, source, replace = false, skipDeps = false } = opts;
  const { sourceDir, id, cleanup } = source;

  try {
    installFromPath({
      shopRoot,
      kind,
      id,
      sourceDir,
      replace,
    });

    if (!skipDeps) {
      await mergeExtensionDependencies(shopRoot, sourceDir);
    }

    return id;
  } finally {
    if (cleanup && existsSync(cleanup)) {
      rmSync(cleanup, { recursive: true, force: true });
    }
  }
}

/**
 * Merge peerDependencies and bermooda.dependencies into the shop, then npm install.
 * @param {string} shopRoot
 * @param {string} packageDir
 */
export async function mergeExtensionDependencies(shopRoot, packageDir) {
  const pkg = readPackageJson(packageDir);
  if (!pkg) return;

  /** @type {Record<string, string>} */
  const deps = {
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.bermooda?.dependencies ?? {}),
  };
  const keys = Object.keys(deps);
  if (keys.length === 0) return;

  info(
    `Merging ${keys.length} dependenc${keys.length === 1 ? 'y' : 'ies'} into shop package.json`
  );
  mergeDependencies(shopRoot, deps);
  const code = await npm(shopRoot, ['install']);
  if (code !== 0) {
    error('npm install failed after merging extension dependencies');
    process.exit(EXIT.DEPS);
  }
}
