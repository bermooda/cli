import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { EXIT } from './constants.js';
import { extractTarball } from './fs-install.js';
import { debug, error } from './logger.js';
import { readPackageJson } from './package-json.js';
import { runCapture } from './process.js';

/**
 * True when the specifier already embeds a version after the package name.
 * Examples: `left-pad@1.0.0`, `@scope/pkg@1.2.3`
 * Not: `@scope/pkg`, `left-pad`
 * @param {string} spec
 */
export function hasEmbeddedVersion(spec) {
  const s = String(spec);
  if (s.startsWith('@')) {
    const slash = s.indexOf('/');
    if (slash === -1) return false;
    return s.indexOf('@', slash) !== -1;
  }
  return s.includes('@');
}

/**
 * Build an npm package specifier from a name and optional version positional.
 * @param {string} name
 * @param {string} [version]
 * @returns {string}
 */
export function buildNpmSpecifier(name, version) {
  const n = String(name).trim();
  if (!n) {
    throw new Error('Package name is required');
  }
  if (hasEmbeddedVersion(n)) {
    return n;
  }
  if (version) {
    return `${n}@${version}`;
  }
  return n;
}

/**
 * Loose check: treat any non-empty name as an npm package specifier.
 * Scoped packages (`@scope/name`) are the primary official form.
 * @param {string} [name]
 */
export function isNpmPackageName(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (!n) return false;
  // Reject obvious path-like args (those should use --path)
  if (n.startsWith('.') || n.startsWith('/') || n.includes('\\')) return false;
  return true;
}

/**
 * Run `npm pack` and return the absolute path to the created tarball.
 * @param {string} spec
 * @param {string} packDest
 * @returns {Promise<string>}
 */
export async function npmPack(spec, packDest) {
  mkdirSync(packDest, { recursive: true });
  debug(`npm pack ${spec} → ${packDest}`);
  const { code, stdout, stderr } = await runCapture('npm', [
    'pack',
    spec,
    '--pack-destination',
    packDest,
  ]);
  if (code !== 0) {
    const detail = (stderr || stdout || '').trim();
    const err = new Error(
      detail
        ? `npm pack failed for ${spec}:\n${detail}`
        : `npm pack failed for ${spec} (exit ${code})`
    );
    /** @type {any} */ (err).exitCode = EXIT.NETWORK;
    throw err;
  }

  // Prefer the last non-empty stdout line (npm prints the tarball filename)
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const printed = lines.length > 0 ? lines[lines.length - 1] : '';
  if (printed) {
    const entries = readdirSync(packDest);
    const match = entries.find((e) => e === basename(printed));
    if (match) return join(packDest, match);
  }

  const tgz = readdirSync(packDest).filter((f) => f.endsWith('.tgz'));
  if (tgz.length === 1) return join(packDest, tgz[0]);
  if (tgz.length > 1) {
    tgz.sort();
    return join(packDest, tgz[tgz.length - 1]);
  }

  const err = new Error(`npm pack produced no tarball for ${spec}`);
  /** @type {any} */ (err).exitCode = EXIT.NETWORK;
  throw err;
}

/**
 * Download an npm package via `npm pack`, extract it, and return the package root.
 * Caller must delete `cleanup` when finished.
 * @param {string} spec
 * @returns {Promise<{ sourceDir: string, cleanup: string, packageJson: object | null }>}
 */
export async function downloadNpmPackage(spec) {
  const root = join(tmpdir(), `bermooda-npm-${Date.now()}`);
  const packDest = join(root, 'pack');
  const extractParent = join(root, 'extract');
  mkdirSync(packDest, { recursive: true });
  mkdirSync(extractParent, { recursive: true });

  try {
    const tarball = await npmPack(spec, packDest);
    const sourceDir = await extractTarball(tarball, extractParent);
    return {
      sourceDir,
      cleanup: root,
      packageJson: readPackageJson(sourceDir),
    };
  } catch (err) {
    rmSync(root, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Exit helper for npm pack failures used by commands.
 * @param {unknown} err
 * @param {string} [hint]
 * @returns {never}
 */
export function exitFromNpmError(err, hint) {
  const message = /** @type {Error} */ (err).message;
  error(message);
  if (hint) error(hint);
  process.exit(/** @type {any} */ (err).exitCode ?? EXIT.NETWORK);
}
