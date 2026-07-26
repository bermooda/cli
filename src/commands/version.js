import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { APP_REPO_SLUG } from '../lib/constants.js';
import { getCliVersion, readPackageJson } from '../lib/package-json.js';
import { findProjectRoot, readProjectMeta } from '../lib/project.js';

/**
 * @param {{ cli?: boolean, shop?: boolean, cwd?: string, json?: boolean }} args
 */
export async function versionCommand(args = {}) {
  const showCli = args.cli || (!args.cli && !args.shop);
  const showShop = args.shop || (!args.cli && !args.shop);
  const cwd = args.cwd ?? process.cwd();

  const out = {};

  if (showCli) {
    out.cli = getCliVersion();
  }

  if (showShop) {
    const root = findProjectRoot(cwd);
    if (!root) {
      out.shop = null;
      out.shopError = 'Not inside a bermooda shop';
    } else {
      const pkg = readPackageJson(root);
      const meta = readProjectMeta(root);
      out.shop = {
        version: pkg?.version ?? null,
        name: pkg?.name ?? null,
        root,
        sourceRef: meta?.sourceRef ?? null,
        appRepo: meta?.appRepo ?? APP_REPO_SLUG,
        installMode: meta?.installMode ?? null,
        hasEnv: existsSync(join(root, '.env')),
      };
    }
  }

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (showCli) {
    console.log(`@bermooda/cli ${out.cli}`);
  }
  if (showShop) {
    if (out.shopError) {
      console.log(`shop: (not in a shop — ${out.shopError})`);
    } else {
      const s = out.shop;
      const ref = s.sourceRef ? ` @ ${s.sourceRef}` : '';
      console.log(`shop ${s.version ?? 'unknown'}${ref}`);
      console.log(`  root: ${s.root}`);
    }
  }
}
