import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { APP_NPM_PACKAGE, APP_REPO, APP_REPO_SLUG, EXIT } from './constants.js';
import { debug, error, info } from './logger.js';
import { downloadNpmPackage, exitFromNpmError } from './npm-pack.js';
import { run } from './process.js';

/**
 * Resolve latest release tag for the app, or null.
 * @returns {Promise<string | null>}
 */
export async function getLatestReleaseTag() {
  const url = `https://api.github.com/repos/${APP_REPO_SLUG}/releases/latest`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': '@bermooda/cli',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<boolean>}
 */
async function hasGit() {
  try {
    return (await run('git', ['--version'], { silent: true })) === 0;
  } catch {
    return false;
  }
}

/**
 * Copy app source from a local checkout (offline / smoke installs).
 * @param {string} sourceDir
 * @param {string} targetDir
 * @returns {{ sourceRef: string, method: 'local' }}
 */
export function copyLocalApp(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    error(`Local source not found: ${sourceDir}`);
    process.exit(EXIT.USER);
  }
  const pkgPath = join(sourceDir, 'package.json');
  if (!existsSync(pkgPath)) {
    error(`Not a valid app source (missing package.json): ${sourceDir}`);
    process.exit(EXIT.USER);
  }
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const base = src.slice(sourceDir.length).replace(/^[/\\]/, '');
      if (!base) return true;
      const first = base.split(/[/\\]/)[0];
      // Skip heavy / machine-local dirs
      if (
        first === 'node_modules' ||
        first === '.git' ||
        first === 'build' ||
        first === '.react-router' ||
        first === 'coverage' ||
        first === '.bermooda'
      ) {
        return false;
      }
      // Skip SQLite DBs
      if (/\.db(-journal|-wal|-shm)?$/i.test(base)) return false;
      if (base === '.env' || base.startsWith('.env.')) return false;
      return true;
    },
  });
  return { sourceRef: `local:${sourceDir}`, method: 'local' };
}

/**
 * Download the published shop package from npm into targetDir.
 * @param {string} targetDir
 * @param {string} [version]  npm version / dist-tag (default: latest)
 * @returns {Promise<{ sourceRef: string, method: 'npm' }>}
 */
export async function downloadAppFromNpm(targetDir, version = 'latest') {
  const spec = `${APP_NPM_PACKAGE}@${version}`;
  info(`Downloading ${spec} from npm…`);
  let packed;
  try {
    packed = await downloadNpmPackage(spec);
  } catch (err) {
    exitFromNpmError(
      err,
      'Pass --ref <tag|branch> to install from GitHub, or --source <path>.'
    );
  }

  try {
    mkdirSync(targetDir, { recursive: true });
    cpSync(packed.sourceDir, targetDir, { recursive: true });
    const resolved =
      typeof packed.packageJson?.version === 'string'
        ? packed.packageJson.version
        : version;
    return {
      sourceRef: `${APP_NPM_PACKAGE}@${resolved}`,
      method: 'npm',
    };
  } finally {
    rmSync(packed.cleanup, { recursive: true, force: true });
  }
}

/**
 * Download app source into a temporary directory (for non-git shop updates).
 * @param {{ ref?: string }} opts
 * @returns {Promise<{ extractDir: string, sourceRef: string, method: 'git' | 'tarball' | 'npm', cleanup: () => void }>}
 */
export async function downloadAppToTemp({ ref } = {}) {
  const extractDir = join(tmpdir(), `bermooda-update-${Date.now()}`);
  mkdirSync(extractDir, { recursive: true });
  const result = await downloadApp({ targetDir: extractDir, ref });
  return {
    extractDir,
    sourceRef: result.sourceRef,
    method: result.method,
    cleanup: () => {
      rmSync(extractDir, { recursive: true, force: true });
    },
  };
}

/**
 * Download app source into targetDir.
 *
 * Default (no `ref`): published npm package `bermooda@latest`.
 * With `ref`: prefers git clone when git is available; falls back to GitHub archive tarball.
 * Pass `source` for a local app checkout (no network).
 *
 * @param {{ targetDir: string, ref?: string, source?: string }} opts
 * @returns {Promise<{ sourceRef: string, method: 'git' | 'tarball' | 'local' | 'npm' }>}
 */
export async function downloadApp({ targetDir, ref, source }) {
  if (source) {
    info(`Copying local app source from ${source}…`);
    return copyLocalApp(source, targetDir);
  }

  if (!ref) {
    return downloadAppFromNpm(targetDir);
  }

  const resolvedRef = ref;

  mkdirSync(targetDir, { recursive: true });

  if (await hasGit()) {
    info(`Cloning ${APP_REPO_SLUG}@${resolvedRef}…`);
    const code = await run('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      resolvedRef,
      APP_REPO,
      targetDir,
    ]);
    if (code === 0) {
      return { sourceRef: resolvedRef, method: 'git' };
    }
    debug(`git clone --branch ${resolvedRef} failed; trying tarball`);
    if (existsSync(join(targetDir, '.git')) || readdirSync(targetDir).length) {
      rmSync(targetDir, { recursive: true, force: true });
      mkdirSync(targetDir, { recursive: true });
    }
  }

  // Prefer tags path when ref looks like a version; else heads
  const archiveCandidates = [
    `refs/tags/${resolvedRef}`,
    `refs/heads/${resolvedRef}`,
  ];

  let lastStatus = 0;
  for (const archivePath of archiveCandidates) {
    const tarballUrl = `https://github.com/${APP_REPO_SLUG}/archive/${archivePath}.tar.gz`;
    info(`Downloading ${tarballUrl}…`);
    const res = await fetch(tarballUrl, {
      headers: { 'User-Agent': '@bermooda/cli' },
      redirect: 'follow',
    });
    lastStatus = res.status;
    if (!res.ok) continue;

    const tmpTar = join(tmpdir(), `bermooda-app-${Date.now()}.tar.gz`);
    if (!res.body) {
      error('Empty response body from GitHub');
      process.exit(EXIT.NETWORK);
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpTar));

    const extractParent = join(tmpdir(), `bermooda-extract-${Date.now()}`);
    mkdirSync(extractParent, { recursive: true });
    const tarCode = await run('tar', ['-xzf', tmpTar, '-C', extractParent]);
    rmSync(tmpTar, { force: true });
    if (tarCode !== 0) {
      error('Failed to extract app tarball (is `tar` available?)');
      process.exit(EXIT.NETWORK);
    }

    const entries = readdirSync(extractParent);
    if (entries.length !== 1) {
      error('Unexpected tarball layout');
      process.exit(EXIT.NETWORK);
    }
    const unpacked = join(extractParent, entries[0]);
    cpSync(unpacked, targetDir, { recursive: true });
    rmSync(extractParent, { recursive: true, force: true });
    return { sourceRef: resolvedRef, method: 'tarball' };
  }

  error(
    `Failed to download app source (last HTTP ${lastStatus}). Check network or pass --ref.`
  );
  process.exit(EXIT.NETWORK);
}
