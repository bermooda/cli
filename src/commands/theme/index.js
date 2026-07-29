import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from '../../lib/constants.js';
import {
  installExtension,
  resolveExtensionSource,
} from '../../lib/extension-source.js';
import { setShopExtensions } from '../../lib/extensions-settings.js';
import { listInstalled } from '../../lib/fs-install.js';
import { error, success } from '../../lib/logger.js';
import { assertInShop } from '../../lib/project.js';

/**
 * @param {Record<string, any>} args
 */
export async function themeAdd(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const source = await resolveExtensionSource({
    kind: 'theme',
    name: args.name,
    version: args.version,
    path: args.path,
    git: args.git,
    tarball: args.tarball,
  });

  const id = await installExtension({
    shopRoot,
    kind: 'theme',
    source,
    replace: false,
    skipDeps: Boolean(args.skipDeps),
  });

  if (args.activate) {
    const pkgJsonPath = join(shopRoot, 'app', 'themes', id, 'package.json');
    let packageId = id;
    if (existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        if (pkg.name) packageId = pkg.name;
      } catch {
        // ignore — fall back to slug
      }
    }
    await setShopExtensions(shopRoot, { activeTheme: packageId });
  }
  return id;
}

/**
 * @param {Record<string, any>} args
 */
export async function themeUpdate(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  if (!args.name && !args.path && !args.tarball && !args.git) {
    error(
      'Usage: bermooda theme update <npm-package|id> [version]\n' +
        '  Example: bermooda theme update @bermooda/theme-paper'
    );
    process.exit(EXIT.USER);
  }

  const source = await resolveExtensionSource({
    kind: 'theme',
    name: args.name,
    version: args.version,
    path: args.path,
    git: args.git,
    tarball: args.tarball,
  });

  const id = await installExtension({
    shopRoot,
    kind: 'theme',
    source,
    replace: true,
    skipDeps: Boolean(args.skipDeps),
  });
  success(`Updated theme ${id}`);
  return id;
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

  add <npm-package> [version]     Install a theme from npm (default)
  update <npm-package> [version]  Update a theme from npm
  remove <id>                     Remove a theme (not "default")
  list                            List installed themes
  help                            This help

Examples:
  bermooda theme add @bermooda/theme-paper
  bermooda theme add @bermooda/theme-paper 1.0.0
  bermooda theme add @some-org/bermooda-theme-dark

Alternate sources for add/update:
  --path <dir>
  --git <url>#ref
  --tarball <url>
  --skip-deps      Skip merging peer deps / npm install
  --activate       Set activeTheme after add (writes shop settings)
`);
}
