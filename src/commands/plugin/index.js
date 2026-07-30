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
export async function pluginAdd(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const source = await resolveExtensionSource({
    kind: 'plugin',
    name: args.name,
    version: args.version,
    path: args.path,
    git: args.git,
    tarball: args.tarball,
  });

  const id = await installExtension({
    shopRoot,
    kind: 'plugin',
    source,
    replace: false,
    skipDeps: Boolean(args.skipDeps),
  });

  if (args.enable) {
    const pkgJsonPath = join(shopRoot, 'app', 'plugins', id, 'package.json');
    let packageId = id;
    if (existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        if (pkg.name) packageId = pkg.name;
      } catch {
        // ignore — fall back to slug
      }
    }
    await setShopExtensions(shopRoot, { enablePlugin: packageId });
  }
  return id;
}

/**
 * @param {Record<string, any>} args
 */
export async function pluginUpdate(args) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  if (!args.name && !args.path && !args.tarball && !args.git) {
    error(
      'Usage: bermooda plugin update <npm-package|id> [version]\n' +
        '  Example: bermooda plugin update @bermooda/plugin-subscriptions'
    );
    process.exit(EXIT.USER);
  }

  const source = await resolveExtensionSource({
    kind: 'plugin',
    name: args.name,
    version: args.version,
    path: args.path,
    git: args.git,
    tarball: args.tarball,
  });

  const id = await installExtension({
    shopRoot,
    kind: 'plugin',
    source,
    replace: true,
    skipDeps: Boolean(args.skipDeps),
  });
  success(`Updated plugin ${id}`);
  return id;
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

  add <npm-package> [version]     Install a plugin from npm (default)
  update <npm-package> [version]  Update a plugin from npm
  remove <id>                     Remove a plugin
  list                            List installed plugins
  help                            This help

Examples:
  bermooda plugin add @bermooda/plugin-subscriptions
  bermooda plugin add @bermooda/plugin-subscriptions 1.2.0
  bermooda plugin add @some-org/bermooda-plugin-foo

Alternate sources for add/update:
  --path <dir>     Install from local directory
  --git <url>#ref  Install from git
  --tarball <url>  Install from HTTPS tarball
  --skip-deps      Skip shop peer-dep merge and extension-local npm install
  --enable         Enable after install (writes shop settings)
`);
}
