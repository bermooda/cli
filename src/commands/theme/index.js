import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { EXIT } from '../../lib/constants.js';
import {
  detectPackageId,
  extractTarball,
  installFromPath,
  listInstalled,
} from '../../lib/fs-install.js';
import { error, success, warn } from '../../lib/logger.js';
import { run } from '../../lib/process.js';
import { assertInShop } from '../../lib/project.js';
import { resolvePackage } from '../../lib/registry.js';

/**
 * @param {Record<string, any>} args
 */
export async function themeAdd(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  if (!args.name && !args.path && !args.git && !args.tarball) {
    error('Usage: bermooda theme add <theme-name> [version]');
    process.exit(EXIT.USER);
  }

  let sourceDir;
  let id;
  let cleanup;

  if (args.path) {
    sourceDir = resolve(args.path);
    id = args.name ?? detectPackageId(sourceDir, 'theme');
  } else if (args.git) {
    const tmp = join(tmpdir(), `bermooda-theme-git-${Date.now()}`);
    const [url, gitRef] = String(args.git).split('#');
    const gitArgs = ['clone', '--depth', '1'];
    if (gitRef) gitArgs.push('--branch', gitRef);
    gitArgs.push(url, tmp);
    const code = await run('git', gitArgs);
    if (code !== 0) {
      error('git clone failed for theme');
      process.exit(EXIT.NETWORK);
    }
    sourceDir = tmp;
    id = args.name ?? detectPackageId(sourceDir, 'theme');
    cleanup = tmp;
  } else if (args.tarball) {
    const extractParent = join(tmpdir(), `bermooda-theme-tar-${Date.now()}`);
    sourceDir = await extractTarball(args.tarball, extractParent);
    id = args.name ?? detectPackageId(sourceDir, 'theme');
    cleanup = extractParent;
  } else {
    const { pkg, version, meta } = await resolvePackage(
      'theme',
      args.name,
      args.version
    );
    id = pkg.id;
    if (!meta.tarball) {
      error(`Registry entry for ${id}@${version} has no tarball URL`);
      process.exit(EXIT.USER);
    }
    const extractParent = join(tmpdir(), `bermooda-theme-reg-${Date.now()}`);
    sourceDir = await extractTarball(meta.tarball, extractParent);
    cleanup = extractParent;
  }

  try {
    installFromPath({
      shopRoot,
      kind: 'theme',
      id,
      sourceDir,
      replace: false,
    });
    if (args.activate) {
      warn(
        `To activate theme "${id}", set activeTheme in Admin → Themes (or shop settings). CLI DB write not implemented in v0.1.`
      );
    }
  } finally {
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
}

/**
 * @param {Record<string, any>} args
 */
export async function themeUpdate(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  if (!args.name && !args.path && !args.tarball && !args.git) {
    error('Usage: bermooda theme update <theme-name> [version]');
    process.exit(EXIT.USER);
  }

  let sourceDir;
  let id;
  let cleanup;
  const name = args.name;

  if (args.path) {
    sourceDir = resolve(args.path);
    id = name ?? detectPackageId(sourceDir, 'theme');
  } else if (args.tarball) {
    const extractParent = join(tmpdir(), `bermooda-theme-tar-${Date.now()}`);
    sourceDir = await extractTarball(args.tarball, extractParent);
    id = name ?? detectPackageId(sourceDir, 'theme');
    cleanup = extractParent;
  } else if (args.git) {
    const tmp = join(tmpdir(), `bermooda-theme-git-${Date.now()}`);
    const [url, gitRef] = String(args.git).split('#');
    const gitArgs = ['clone', '--depth', '1'];
    if (gitRef) gitArgs.push('--branch', gitRef);
    gitArgs.push(url, tmp);
    if ((await run('git', gitArgs)) !== 0) {
      error('git clone failed');
      process.exit(EXIT.NETWORK);
    }
    sourceDir = tmp;
    id = name ?? detectPackageId(sourceDir, 'theme');
    cleanup = tmp;
  } else {
    const { pkg, version, meta } = await resolvePackage(
      'theme',
      name,
      args.version
    );
    id = pkg.id;
    if (!meta.tarball) {
      error(`No tarball for ${id}@${version}`);
      process.exit(EXIT.USER);
    }
    const extractParent = join(tmpdir(), `bermooda-theme-reg-${Date.now()}`);
    sourceDir = await extractTarball(meta.tarball, extractParent);
    cleanup = extractParent;
  }

  try {
    installFromPath({
      shopRoot,
      kind: 'theme',
      id,
      sourceDir,
      replace: true,
    });
    success(`Updated theme ${id}`);
  } finally {
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
}

/**
 * @param {Record<string, any>} args
 */
export async function themeRemove(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const id = args.name;
  if (!id) {
    error('Usage: bermooda theme remove <theme-name>');
    process.exit(EXIT.USER);
  }
  if (id === 'default') {
    error('Refusing to remove the default theme');
    process.exit(EXIT.USER);
  }
  const dest = join(shopRoot, 'app', 'themes', id);
  if (!existsSync(dest)) {
    error(`Theme not found: ${id}`);
    process.exit(EXIT.USER);
  }
  rmSync(dest, { recursive: true, force: true });
  success(`Removed theme ${id}`);
}

/**
 * @param {Record<string, any>} args
 */
export async function themeList(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const list = listInstalled(shopRoot, 'theme');
  if (args.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  if (list.length === 0) {
    console.log('No themes under app/themes/');
    return;
  }
  for (const item of list) {
    console.log(`${item.id}${item.version ? ` @ ${item.version}` : ''}`);
  }
}

export async function themeHelp() {
  console.log(`bermooda theme commands:

  add <name> [version]     Install a theme
  update <name> [version]  Update a theme
  remove <name>            Remove a theme (not "default")
  list                     List installed themes
  help                     This help

Options for add/update:
  --path <dir>
  --git <url>#ref
  --tarball <url>
  --activate               Hint to set activeTheme (admin recommended)
`);
}
