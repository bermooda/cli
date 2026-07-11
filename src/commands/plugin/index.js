import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { EXIT } from '../../lib/constants.js';
import {
  detectPackageId,
  extractTarball,
  installFromPath,
  listInstalled,
} from '../../lib/fs-install.js';
import { error, info, success } from '../../lib/logger.js';
import { run } from '../../lib/process.js';
import { assertInShop } from '../../lib/project.js';
import { resolvePackage } from '../../lib/registry.js';

/**
 * @param {Record<string, any>} args
 */
export async function pluginAdd(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const name = args.name;
  if (!name && !args.path && !args.git && !args.tarball) {
    error('Usage: bermooda plugin add <plugin-name> [version]');
    process.exit(EXIT.USER);
  }

  let sourceDir;
  let id;
  let cleanup;

  if (args.path) {
    sourceDir = resolve(args.path);
    id = args.name ?? detectPackageId(sourceDir, 'plugin');
  } else if (args.git) {
    const tmp = join(tmpdir(), `bermooda-plugin-git-${Date.now()}`);
    const [url, gitRef] = String(args.git).split('#');
    const gitArgs = ['clone', '--depth', '1'];
    if (gitRef) gitArgs.push('--branch', gitRef);
    gitArgs.push(url, tmp);
    const code = await run('git', gitArgs);
    if (code !== 0) {
      error('git clone failed for plugin');
      process.exit(EXIT.NETWORK);
    }
    sourceDir = tmp;
    id = args.name ?? detectPackageId(sourceDir, 'plugin');
    cleanup = tmp;
  } else if (args.tarball) {
    const extractParent = join(tmpdir(), `bermooda-plugin-tar-${Date.now()}`);
    sourceDir = await extractTarball(args.tarball, extractParent);
    id = args.name ?? detectPackageId(sourceDir, 'plugin');
    cleanup = extractParent;
  } else {
    const { pkg, version, meta } = await resolvePackage(
      'plugin',
      name,
      args.version
    );
    id = pkg.id;
    if (!meta.tarball) {
      error(`Registry entry for ${id}@${version} has no tarball URL`);
      process.exit(EXIT.USER);
    }
    const extractParent = join(tmpdir(), `bermooda-plugin-reg-${Date.now()}`);
    sourceDir = await extractTarball(meta.tarball, extractParent);
    cleanup = extractParent;
  }

  try {
    installFromPath({
      shopRoot,
      kind: 'plugin',
      id,
      sourceDir,
      replace: false,
    });
    if (args.enable) {
      info(
        'Plugin enable via CLI is best-effort; enable in Admin → Plugins if needed.'
      );
    }
  } finally {
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
}

/**
 * @param {Record<string, any>} args
 */
export async function pluginUpdate(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  if (!args.name && !args.path && !args.tarball && !args.git) {
    error('Usage: bermooda plugin update <plugin-name> [version]');
    process.exit(EXIT.USER);
  }

  // Reuse add path with replace
  const name = args.name;
  let sourceDir;
  let id;
  let cleanup;

  if (args.path) {
    sourceDir = resolve(args.path);
    id = name ?? detectPackageId(sourceDir, 'plugin');
  } else if (args.tarball) {
    const extractParent = join(tmpdir(), `bermooda-plugin-tar-${Date.now()}`);
    sourceDir = await extractTarball(args.tarball, extractParent);
    id = name ?? detectPackageId(sourceDir, 'plugin');
    cleanup = extractParent;
  } else if (args.git) {
    const tmp = join(tmpdir(), `bermooda-plugin-git-${Date.now()}`);
    const [url, gitRef] = String(args.git).split('#');
    const gitArgs = ['clone', '--depth', '1'];
    if (gitRef) gitArgs.push('--branch', gitRef);
    gitArgs.push(url, tmp);
    const code = await run('git', gitArgs);
    if (code !== 0) {
      error('git clone failed');
      process.exit(EXIT.NETWORK);
    }
    sourceDir = tmp;
    id = name ?? detectPackageId(sourceDir, 'plugin');
    cleanup = tmp;
  } else {
    const { pkg, version, meta } = await resolvePackage(
      'plugin',
      name,
      args.version
    );
    id = pkg.id;
    if (!meta.tarball) {
      error(`No tarball for ${id}@${version}`);
      process.exit(EXIT.USER);
    }
    const extractParent = join(tmpdir(), `bermooda-plugin-reg-${Date.now()}`);
    sourceDir = await extractTarball(meta.tarball, extractParent);
    cleanup = extractParent;
  }

  try {
    installFromPath({
      shopRoot,
      kind: 'plugin',
      id,
      sourceDir,
      replace: true,
    });
    success(`Updated plugin ${id}`);
  } finally {
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
}

/**
 * @param {Record<string, any>} args
 */
export async function pluginRemove(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const id = args.name;
  if (!id) {
    error('Usage: bermooda plugin remove <plugin-name>');
    process.exit(EXIT.USER);
  }
  const { rmSync, existsSync } = await import('node:fs');
  const dest = join(shopRoot, 'app', 'plugins', id);
  if (!existsSync(dest)) {
    error(`Plugin not found: ${id}`);
    process.exit(EXIT.USER);
  }
  rmSync(dest, { recursive: true, force: true });
  success(`Removed plugin ${id}`);
  info('npm dependencies were not removed (may be shared).');
}

/**
 * @param {Record<string, any>} args
 */
export async function pluginList(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const list = listInstalled(shopRoot, 'plugin');
  if (args.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  if (list.length === 0) {
    console.log('No plugins installed under app/plugins/');
    return;
  }
  for (const item of list) {
    console.log(`${item.id}${item.version ? ` @ ${item.version}` : ''}`);
  }
}

export async function pluginHelp() {
  console.log(`bermooda plugin commands:

  add <name> [version]     Install a plugin
  update <name> [version]  Update a plugin
  remove <name>            Remove a plugin
  list                     List installed plugins
  help                     This help

Options for add/update:
  --path <dir>     Install from local directory
  --git <url>#ref  Install from git
  --tarball <url>  Install from HTTPS tarball
  --enable         Hint to enable after install
`);
}
