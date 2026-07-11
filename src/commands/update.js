import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT, PROJECT_JSON } from '../lib/constants.js';
import { setupDatabase } from '../lib/db.js';
import { downloadAppToTemp, getLatestReleaseTag } from '../lib/download.js';
import { error, info, success } from '../lib/logger.js';
import { getCliVersion } from '../lib/package-json.js';
import { loadShopEnv, run } from '../lib/process.js';
import { assertInShop, readProjectMeta } from '../lib/project.js';
import { mergeAppRelease } from '../lib/update-merge.js';

/**
 * @param {Record<string, any>} args
 */
export async function updateCommand(args = {}) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());
  const meta = readProjectMeta(shopRoot);
  const ref = args.ref ?? (await getLatestReleaseTag()) ?? 'main';
  const dryRun = Boolean(args.dryRun);

  info(`Updating shop at ${shopRoot} → ${ref}`);
  if (meta?.sourceRef) {
    info(`Previous sourceRef: ${meta.sourceRef}`);
  }

  const hasGit = existsSync(join(shopRoot, '.git'));

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          shopRoot,
          targetRef: ref,
          strategy: hasGit ? 'git-ff' : 'tarball-merge',
          previousRef: meta?.sourceRef ?? null,
        },
        null,
        2
      )
    );
    return;
  }

  if (hasGit) {
    info('Fetching and fast-forwarding git…');
    let code = await run('git', ['fetch', '--tags', '--prune'], {
      cwd: shopRoot,
    });
    if (code !== 0) {
      error('git fetch failed');
      process.exit(EXIT.NETWORK);
    }

    // Try checkout/merge of ref
    code = await run('git', ['merge', '--ff-only', `origin/${ref}`], {
      cwd: shopRoot,
    });
    if (code !== 0) {
      // try tag directly
      code = await run('git', ['merge', '--ff-only', ref], { cwd: shopRoot });
    }
    if (code !== 0) {
      error(
        'Fast-forward merge failed. Commit or stash local changes to core paths, or resolve conflicts manually.'
      );
      process.exit(EXIT.USER);
    }
    success('Git update complete');
    writeProjectRef(shopRoot, ref, meta);
  } else {
    info('Non-git shop: downloading app release and merging core paths…');
    const { extractDir, sourceRef, cleanup } = await downloadAppToTemp({ ref });
    try {
      const result = mergeAppRelease(shopRoot, extractDir, { sourceRef });
      success(
        `Tarball merge complete (${result.copied.length} paths, source ${sourceRef})`
      );
    } finally {
      cleanup();
    }
  }

  info('Installing dependencies…');
  const env = loadShopEnv(shopRoot);
  const npmCode = await run('npm', ['install'], { cwd: shopRoot, env });
  if (npmCode !== 0) {
    error('npm install failed');
    process.exit(EXIT.DEPS);
  }

  await setupDatabase(shopRoot);
  success(`Shop updated to ${ref}`);
}

/**
 * @param {string} shopRoot
 * @param {string} ref
 * @param {object | null} meta
 */
function writeProjectRef(shopRoot, ref, meta) {
  const path = join(shopRoot, PROJECT_JSON);
  const next = {
    ...(meta ?? {}),
    sourceRef: ref,
    updatedAt: new Date().toISOString(),
    cliVersion: getCliVersion(),
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}
