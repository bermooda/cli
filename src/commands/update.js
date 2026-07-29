import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP_NPM_PACKAGE, EXIT, PROJECT_JSON } from '../lib/constants.js';
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
  /** @type {string | undefined} */
  const ref = args.ref ?? (await getLatestReleaseTag()) ?? undefined;
  const dryRun = Boolean(args.dryRun);
  const targetLabel = ref ?? `${APP_NPM_PACKAGE}@latest`;

  info(`Updating shop at ${shopRoot} → ${targetLabel}`);
  if (meta?.sourceRef) {
    info(`Previous sourceRef: ${meta.sourceRef}`);
  }

  const hasGit = existsSync(join(shopRoot, '.git'));

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          shopRoot,
          targetRef: targetLabel,
          strategy: hasGit ? 'git-ff' : ref ? 'tarball-merge' : 'npm-merge',
          previousRef: meta?.sourceRef ?? null,
        },
        null,
        2
      )
    );
    return;
  }

  if (hasGit) {
    if (!ref) {
      error(
        `No GitHub release tag found. Pass --ref <branch|tag> to update a git checkout (default branch is often master).`
      );
      process.exit(EXIT.USER);
    }
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
    info(
      ref
        ? 'Non-git shop: downloading app release and merging core paths…'
        : `Non-git shop: downloading ${APP_NPM_PACKAGE}@latest and merging core paths…`
    );
    const { extractDir, sourceRef, cleanup } = await downloadAppToTemp(
      ref ? { ref } : {}
    );
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
  success(`Shop updated to ${targetLabel}`);
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
