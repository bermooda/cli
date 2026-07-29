import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

import { BERMOODA_DIR, EXIT, SAFE_ID_RE } from './constants.js';
import { error, info, success } from './logger.js';
import { run } from './process.js';

/**
 * Ensure a path stays inside baseDir (zip-slip protection).
 * @param {string} baseDir
 * @param {string} targetPath
 */
export function assertInside(baseDir, targetPath) {
  const base = resolve(baseDir) + sep;
  const target = resolve(targetPath);
  if (target !== resolve(baseDir) && !target.startsWith(base)) {
    throw new Error(`Refusing path outside target: ${targetPath}`);
  }
}

/**
 * Copy a local directory into shop plugins or themes folder.
 * @param {{
 *   shopRoot: string,
 *   kind: 'plugin' | 'theme',
 *   id: string,
 *   sourceDir: string,
 *   replace?: boolean,
 * }} opts
 */
export function installFromPath(opts) {
  const { shopRoot, kind, id, sourceDir, replace } = opts;
  if (!SAFE_ID_RE.test(id)) {
    error(`Invalid ${kind} id "${id}"`);
    process.exit(EXIT.USER);
  }
  const destRoot =
    kind === 'plugin'
      ? join(shopRoot, 'app', 'plugins', id)
      : join(shopRoot, 'app', 'themes', id);

  assertInside(join(shopRoot, 'app'), destRoot);

  const shape = validatePackageShape(sourceDir, kind);
  if (!shape.ok) {
    error(`Invalid ${kind} package at ${sourceDir}: ${shape.reason}`);
    process.exit(EXIT.USER);
  }

  if (existsSync(destRoot)) {
    if (!replace) {
      error(
        `${kind} "${id}" already exists at ${destRoot}. Use update to replace.`
      );
      process.exit(EXIT.USER);
    }
    const backup = join(
      shopRoot,
      BERMOODA_DIR,
      'backups',
      `${kind}s`,
      `${id}-${Date.now()}`
    );
    mkdirSync(dirname(backup), { recursive: true });
    info(`Backing up existing ${kind} to ${backup}`);
    cpSync(destRoot, backup, { recursive: true });
    rmSync(destRoot, { recursive: true, force: true });
  }

  mkdirSync(dirname(destRoot), { recursive: true });
  cpSync(sourceDir, destRoot, {
    recursive: true,
    filter: (src) => {
      // Zip-slip / path safety: refuse copying outside sourceDir
      try {
        assertInside(sourceDir, src);
      } catch {
        return false;
      }
      return true;
    },
  });
  success(`Installed ${kind} "${id}" → ${destRoot}`);
  return destRoot;
}

/**
 * Extract a tarball URL or local file into a temp dir, return package root.
 * @param {string} tarball
 * @param {string} extractParent
 */
export async function extractTarball(tarball, extractParent) {
  mkdirSync(extractParent, { recursive: true });
  let localTar = tarball;
  if (/^https?:\/\//i.test(tarball)) {
    if (!tarball.startsWith('https://')) {
      error('Only HTTPS tarball URLs are allowed');
      process.exit(EXIT.NETWORK);
    }
    const res = await fetch(tarball, {
      headers: { 'User-Agent': '@bermooda/cli' },
      redirect: 'follow',
    });
    if (!res.ok) {
      error(`Failed to download tarball (${res.status})`);
      process.exit(EXIT.NETWORK);
    }
    const { writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    localTar = join(tmpdir(), `bermooda-pkg-${Date.now()}.tar.gz`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(localTar, buf);
  }

  const code = await run('tar', ['-xzf', localTar, '-C', extractParent]);
  if (code !== 0) {
    error('Failed to extract package tarball');
    process.exit(EXIT.NETWORK);
  }

  const entries = readdirSync(extractParent);
  if (
    entries.length === 1 &&
    statSync(join(extractParent, entries[0])).isDirectory()
  ) {
    return join(extractParent, entries[0]);
  }
  return extractParent;
}

/**
 * Validate installed package shape for plugins/themes.
 * @param {string} dir
 * @param {'plugin' | 'theme'} kind
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validatePackageShape(dir, kind) {
  if (kind === 'plugin') {
    const hasManifest = existsSync(join(dir, 'manifest.js'));
    const hasIndex =
      existsSync(join(dir, 'index.server.js')) ||
      existsSync(join(dir, 'index.js'));
    if (!hasManifest && !hasIndex) {
      return {
        ok: false,
        reason: 'plugin must include manifest.js and/or index.server.js',
      };
    }
    return { ok: true };
  }
  // Themes: directory with at least one component-ish file, or manifest
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { ok: false, reason: 'theme path is not a directory' };
  }
  const entries = readdirSync(dir);
  if (entries.length === 0) {
    return { ok: false, reason: 'theme directory is empty' };
  }
  return { ok: true };
}

/**
 * Try to read id from manifest.js (best-effort string match) or package.json.
 * Folder on disk = bermooda.slug (preferred), so slug takes highest priority.
 * @param {string} dir
 * @param {'plugin' | 'theme'} kind
 */
export function detectPackageId(dir, kind) {
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      // bermooda.slug is canonical: the folder on disk equals the slug.
      if (pkg.bermooda?.slug && SAFE_ID_RE.test(pkg.bermooda.slug)) {
        return pkg.bermooda.slug;
      }
      if (pkg.bermooda?.id && SAFE_ID_RE.test(pkg.bermooda.id)) {
        return pkg.bermooda.id;
      }
      if (pkg.name) {
        let slug = String(pkg.name).replace(/^@[^/]+\//, '');
        // Official packages use @bermooda/theme-* and @bermooda/plugin-*
        if (kind === 'theme' && slug.startsWith('theme-')) {
          slug = slug.slice('theme-'.length);
        } else if (kind === 'plugin' && slug.startsWith('plugin-')) {
          slug = slug.slice('plugin-'.length);
        }
        slug = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        if (SAFE_ID_RE.test(slug)) return slug;
      }
    } catch {
      // ignore
    }
  }

  const manifestPath = join(dir, 'manifest.js');
  if (existsSync(manifestPath)) {
    const text = readFileSync(manifestPath, 'utf8');
    const m = text.match(/id\s*:\s*['"]([a-z0-9-]+)['"]/);
    if (m) return m[1];
  }

  // folder name fallback
  const base = dir.split(/[/\\]/).filter(Boolean).pop();
  if (base && SAFE_ID_RE.test(base)) return base;

  error(`Could not detect ${kind} id in ${dir}`);
  process.exit(EXIT.USER);
}

/**
 * List installed plugins or themes from filesystem.
 * @param {string} shopRoot
 * @param {'plugin' | 'theme'} kind
 * @returns {{ id: string, path: string, version?: string }[]}
 */
export function listInstalled(shopRoot, kind) {
  const root =
    kind === 'plugin'
      ? join(shopRoot, 'app', 'plugins')
      : join(shopRoot, 'app', 'themes');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => {
      const p = join(root, name);
      return statSync(p).isDirectory() && !name.startsWith('.');
    })
    .map((id) => {
      let version;
      const manifest = join(root, id, 'manifest.js');
      if (existsSync(manifest)) {
        const text = readFileSync(manifest, 'utf8');
        const m = text.match(/version\s*:\s*['"]([^'"]+)['"]/);
        if (m) version = m[1];
      }
      return { id, path: join(root, id), version };
    });
}
