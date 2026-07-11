import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  mergeAppRelease,
  safeShopPath,
  UPDATE_CORE_PATHS,
  UPDATE_PRESERVE,
} from '../src/lib/update-merge.js';

describe('mergeAppRelease', () => {
  it('copies core paths and preserves shop-only plugins', () => {
    const shop = mkdtempSync(join(tmpdir(), 'merge-shop-'));
    const release = mkdtempSync(join(tmpdir(), 'merge-rel-'));

    writeFileSync(join(shop, '.env'), 'SECRET=keepme\n');
    mkdirSync(join(shop, 'app', 'core'), { recursive: true });
    writeFileSync(join(shop, 'app', 'core', 'old.js'), 'old');
    mkdirSync(join(shop, 'app', 'plugins', 'user-only'), { recursive: true });
    writeFileSync(
      join(shop, 'app', 'plugins', 'user-only', 'manifest.js'),
      'export default {};'
    );
    mkdirSync(join(shop, 'app', 'plugins', 'sample-analytics'), {
      recursive: true,
    });
    writeFileSync(
      join(shop, 'app', 'plugins', 'sample-analytics', 'manifest.js'),
      'export default { v: 1 };'
    );

    mkdirSync(join(release, 'app', 'core'), { recursive: true });
    writeFileSync(join(release, 'app', 'core', 'new.js'), 'new');
    writeFileSync(join(release, 'package.json'), '{"name":"bermooda"}');
    mkdirSync(join(release, 'app', 'plugins', 'sample-analytics'), {
      recursive: true,
    });
    writeFileSync(
      join(release, 'app', 'plugins', 'sample-analytics', 'manifest.js'),
      'export default { v: 2 };'
    );

    const result = mergeAppRelease(shop, release, {
      sourceRef: 'v9.9.9',
    });

    expect(readFileSync(join(shop, '.env'), 'utf8')).toBe('SECRET=keepme\n');
    expect(readFileSync(join(shop, 'app', 'core', 'new.js'), 'utf8')).toBe(
      'new'
    );
    expect(existsSync(join(shop, 'app', 'core', 'old.js'))).toBe(false);
    expect(
      existsSync(join(shop, 'app', 'plugins', 'user-only', 'manifest.js'))
    ).toBe(true);
    expect(
      readFileSync(
        join(shop, 'app', 'plugins', 'sample-analytics', 'manifest.js'),
        'utf8'
      )
    ).toMatch(/v: 2/);
    expect(result.preservedPlugins).toEqual(['user-only']);

    const meta = JSON.parse(
      readFileSync(join(shop, '.bermooda', 'project.json'), 'utf8')
    );
    expect(meta.sourceRef).toBe('v9.9.9');
    expect(meta.updatedAt).toBeTruthy();
  });

  it('dry-run does not mutate shop files', () => {
    const shop = mkdtempSync(join(tmpdir(), 'merge-dry-'));
    const release = mkdtempSync(join(tmpdir(), 'merge-dry-rel-'));
    mkdirSync(join(shop, 'app', 'core'), { recursive: true });
    writeFileSync(join(shop, 'app', 'core', 'keep.js'), 'keep');
    mkdirSync(join(release, 'app', 'core'), { recursive: true });
    writeFileSync(join(release, 'app', 'core', 'new.js'), 'new');

    mergeAppRelease(shop, release, { sourceRef: 'x', dryRun: true });

    expect(existsSync(join(shop, 'app', 'core', 'keep.js'))).toBe(true);
    expect(existsSync(join(shop, 'app', 'core', 'new.js'))).toBe(false);
  });

  it('preserves shop-only themes', () => {
    const shop = mkdtempSync(join(tmpdir(), 'merge-theme-'));
    const release = mkdtempSync(join(tmpdir(), 'merge-theme-rel-'));
    mkdirSync(join(shop, 'app', 'themes', 'custom'), { recursive: true });
    writeFileSync(join(shop, 'app', 'themes', 'custom', 'x.js'), '1');
    mkdirSync(join(release, 'app', 'themes', 'default'), { recursive: true });
    writeFileSync(join(release, 'app', 'themes', 'default', 'x.js'), '2');

    const result = mergeAppRelease(shop, release, { sourceRef: 't' });
    expect(result.preservedThemes).toContain('custom');
    expect(existsSync(join(shop, 'app', 'themes', 'custom', 'x.js'))).toBe(
      true
    );
    expect(existsSync(join(shop, 'app', 'themes', 'default', 'x.js'))).toBe(
      true
    );
  });
});

describe('safeShopPath / allowlists', () => {
  it('allows paths inside shop', () => {
    const shop = mkdtempSync(join(tmpdir(), 'safe-'));
    expect(safeShopPath(shop, 'app/core')).toBe(join(shop, 'app/core'));
  });

  it('rejects path escape', () => {
    const shop = mkdtempSync(join(tmpdir(), 'safe-esc-'));
    expect(() => safeShopPath(shop, '../outside')).toThrow(/escapes/);
  });

  it('documents core paths and preserve list', () => {
    expect(UPDATE_CORE_PATHS).toContain('package.json');
    expect(UPDATE_CORE_PATHS).toContain('app/core');
    expect(UPDATE_PRESERVE).toContain('.env');
    expect(UPDATE_PRESERVE).toContain('node_modules');
  });
});
