import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  installExtension,
  installExtensionLocalDependencies,
  mergeExtensionDependencies,
  resolveExtensionSource,
} from '../src/lib/extension-source.js';
import {
  buildNpmSpecifier,
  downloadNpmPackage,
  hasEmbeddedVersion,
  isNpmPackageName,
  npmPack,
} from '../src/lib/npm-pack.js';
import { createFixturePlugin, createFixtureShop } from './helpers.js';

describe('npm specifier helpers', () => {
  it('detects embedded versions', () => {
    expect(hasEmbeddedVersion('left-pad@1.0.0')).toBe(true);
    expect(hasEmbeddedVersion('@scope/pkg@1.2.3')).toBe(true);
    expect(hasEmbeddedVersion('@scope/pkg')).toBe(false);
    expect(hasEmbeddedVersion('left-pad')).toBe(false);
  });

  it('builds npm specifiers', () => {
    expect(buildNpmSpecifier('@bermooda/theme-paper')).toBe(
      '@bermooda/theme-paper'
    );
    expect(buildNpmSpecifier('@bermooda/theme-paper', '1.0.0')).toBe(
      '@bermooda/theme-paper@1.0.0'
    );
    expect(buildNpmSpecifier('@bermooda/theme-paper@2.0.0', '1.0.0')).toBe(
      '@bermooda/theme-paper@2.0.0'
    );
    expect(buildNpmSpecifier('my-plugin', '3.1.0')).toBe('my-plugin@3.1.0');
  });

  it('accepts package names and rejects path-like args', () => {
    expect(isNpmPackageName('@bermooda/plugin-subscriptions')).toBe(true);
    expect(isNpmPackageName('some-plugin')).toBe(true);
    expect(isNpmPackageName('./local')).toBe(false);
    expect(isNpmPackageName('/abs/path')).toBe(false);
    expect(isNpmPackageName('')).toBe(false);
  });
});

describe('npmPack + downloadNpmPackage (local package)', () => {
  /** @type {string[]} */
  const cleanups = [];

  afterEach(() => {
    for (const dir of cleanups.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('packs a local package directory', async () => {
    const pkgDir = createFixturePlugin('subscriptions');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-subscriptions',
        version: '1.0.0',
        bermooda: { id: 'subscriptions' },
      })
    );
    const packDest = mkdtempSync(join(tmpdir(), 'npm-pack-dest-'));
    cleanups.push(packDest, pkgDir);

    const tarball = await npmPack(pkgDir, packDest);
    expect(tarball.endsWith('.tgz')).toBe(true);
    expect(readFileSync(tarball).length).toBeGreaterThan(0);
  });

  it('downloads and extracts a local npm package path', async () => {
    const pkgDir = createFixturePlugin('paper');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/theme-paper',
        version: '0.1.0',
        bermooda: { id: 'paper' },
      })
    );
    writeFileSync(join(pkgDir, 'index.jsx'), 'export default null;\n');
    cleanups.push(pkgDir);

    const result = await downloadNpmPackage(pkgDir);
    cleanups.push(result.cleanup);

    expect(result.packageJson?.name).toBe('@bermooda/theme-paper');
    expect(result.packageJson?.bermooda?.id).toBe('paper');
    expect(readFileSync(join(result.sourceDir, 'index.jsx'), 'utf8')).toMatch(
      /export default/
    );
  });
});

describe('resolveExtensionSource + installExtension', () => {
  /** @type {string[]} */
  const cleanups = [];
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let exitSpy;

  afterEach(() => {
    exitSpy?.mockRestore();
    for (const dir of cleanups.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves --path sources', async () => {
    const src = createFixturePlugin('demo');
    cleanups.push(src);
    const resolved = await resolveExtensionSource({
      kind: 'plugin',
      path: src,
    });
    expect(resolved.id).toBe('demo');
    expect(resolved.sourceDir).toBe(src);
  });

  it('installs from a packed local package via npm name override path', async () => {
    // Simulate npm download by packing locally then installing via --path
    // after downloadNpmPackage (offline-safe end-to-end of pack → install)
    const pkgDir = createFixturePlugin('subscriptions');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-subscriptions',
        version: '1.0.0',
        bermooda: { id: 'subscriptions', engine: '>=0.0.0' },
        peerDependencies: { zod: '^3.0.0' },
      })
    );
    cleanups.push(pkgDir);

    const downloaded = await downloadNpmPackage(pkgDir);
    cleanups.push(downloaded.cleanup);

    const shop = createFixtureShop();
    cleanups.push(shop);

    const id = await installExtension({
      shopRoot: shop,
      kind: 'plugin',
      source: {
        sourceDir: downloaded.sourceDir,
        id: 'subscriptions',
        // don't pass cleanup — we own downloaded.cleanup
      },
      skipDeps: true,
    });

    expect(id).toBe('subscriptions');
    expect(
      readFileSync(
        join(shop, 'app', 'plugins', 'subscriptions', 'manifest.js'),
        'utf8'
      )
    ).toMatch(/subscriptions/);
  });

  it('mergeExtensionDependencies writes peers into shop package.json', async () => {
    const shop = createFixtureShop();
    const pkgDir = mkdtempSync(join(tmpdir(), 'ext-deps-'));
    cleanups.push(shop, pkgDir);
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-x',
        peerDependencies: { leftpad: '1.0.0' },
        bermooda: { dependencies: { 'extra-lib': '^2.0.0' } },
      })
    );

    // Avoid real npm install in unit tests
    const npmMod = await import('../src/lib/process.js');
    const npmSpy = vi.spyOn(npmMod, 'npm').mockResolvedValue(0);

    await mergeExtensionDependencies(shop, pkgDir);

    const shopPkg = JSON.parse(
      readFileSync(join(shop, 'package.json'), 'utf8')
    );
    expect(shopPkg.dependencies.leftpad).toBe('1.0.0');
    expect(shopPkg.dependencies['extra-lib']).toBe('^2.0.0');
    expect(npmSpy).toHaveBeenCalled();
    npmSpy.mockRestore();
  });

  it('installExtensionLocalDependencies runs npm install in the extension dir', async () => {
    const pkgDir = mkdtempSync(join(tmpdir(), 'ext-local-deps-'));
    cleanups.push(pkgDir);
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-x',
        dependencies: { 'left-pad': '1.0.0' },
      })
    );

    const npmMod = await import('../src/lib/process.js');
    const npmSpy = vi.spyOn(npmMod, 'npm').mockResolvedValue(0);

    await installExtensionLocalDependencies(pkgDir);

    expect(npmSpy).toHaveBeenCalledWith(pkgDir, ['install']);
    npmSpy.mockRestore();
  });

  it('installExtensionLocalDependencies no-ops when there are no local deps', async () => {
    const pkgDir = mkdtempSync(join(tmpdir(), 'ext-no-deps-'));
    cleanups.push(pkgDir);
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-x',
        peerDependencies: { zod: '^3.0.0' },
      })
    );

    const npmMod = await import('../src/lib/process.js');
    const npmSpy = vi.spyOn(npmMod, 'npm').mockResolvedValue(0);

    await installExtensionLocalDependencies(pkgDir);

    expect(npmSpy).not.toHaveBeenCalled();
    npmSpy.mockRestore();
  });

  it('installExtension installs local package.json deps into the destination', async () => {
    const pkgDir = createFixturePlugin('with-deps');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-with-deps',
        version: '1.0.0',
        bermooda: { id: 'with-deps', engine: '>=0.0.0' },
        dependencies: { 'is-number': '7.0.0' },
        peerDependencies: { zod: '^3.0.0' },
      })
    );
    cleanups.push(pkgDir);

    const shop = createFixtureShop();
    cleanups.push(shop);

    const npmMod = await import('../src/lib/process.js');
    const npmSpy = vi.spyOn(npmMod, 'npm').mockResolvedValue(0);

    const id = await installExtension({
      shopRoot: shop,
      kind: 'plugin',
      source: { sourceDir: pkgDir, id: 'with-deps' },
    });

    expect(id).toBe('with-deps');
    const dest = join(shop, 'app', 'plugins', 'with-deps');
    // Shop peer merge + local extension install
    expect(npmSpy).toHaveBeenCalledWith(shop, ['install']);
    expect(npmSpy).toHaveBeenCalledWith(dest, ['install']);

    const shopPkg = JSON.parse(
      readFileSync(join(shop, 'package.json'), 'utf8')
    );
    expect(shopPkg.dependencies.zod).toBe('^3.0.0');
    npmSpy.mockRestore();
  });

  it('installExtension skipShopDeps still installs local deps', async () => {
    const pkgDir = createFixturePlugin('local-only');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-local-only',
        version: '1.0.0',
        bermooda: { id: 'local-only', engine: '>=0.0.0' },
        dependencies: { 'is-odd': '3.0.0' },
        peerDependencies: { zod: '^3.0.0' },
      })
    );
    cleanups.push(pkgDir);

    const shop = createFixtureShop();
    cleanups.push(shop);

    const npmMod = await import('../src/lib/process.js');
    const npmSpy = vi.spyOn(npmMod, 'npm').mockResolvedValue(0);

    await installExtension({
      shopRoot: shop,
      kind: 'plugin',
      source: { sourceDir: pkgDir, id: 'local-only' },
      skipShopDeps: true,
    });

    const dest = join(shop, 'app', 'plugins', 'local-only');
    expect(npmSpy).toHaveBeenCalledWith(dest, ['install']);
    expect(npmSpy).not.toHaveBeenCalledWith(shop, ['install']);

    const shopPkg = JSON.parse(
      readFileSync(join(shop, 'package.json'), 'utf8')
    );
    expect(shopPkg.dependencies?.zod).toBeUndefined();
    npmSpy.mockRestore();
  });

  it('rejects install when the extension engine range excludes the shop version', async () => {
    const pkgDir = createFixturePlugin('subscriptions');
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bermooda/plugin-subscriptions',
        version: '1.0.0',
        bermooda: { id: 'subscriptions', engine: '>=99.0.0' },
      })
    );
    cleanups.push(pkgDir);

    const shop = createFixtureShop();
    cleanups.push(shop);

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });

    await expect(
      installExtension({
        shopRoot: shop,
        kind: 'plugin',
        source: { sourceDir: pkgDir, id: 'subscriptions' },
        skipDeps: true,
      })
    ).rejects.toThrow(/exit:1/);

    expect(
      existsSync(join(shop, 'app', 'plugins', 'subscriptions', 'manifest.js'))
    ).toBe(false);
  });

  it('exits when no name and no alternate source', async () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    await expect(resolveExtensionSource({ kind: 'theme' })).rejects.toThrow(
      /exit:1/
    );
  });
});

describe('official package id slug heuristics', () => {
  it('strips theme- / plugin- prefixes from package names', async () => {
    const { detectPackageId } = await import('../src/lib/fs-install.js');

    const themeDir = mkdtempSync(join(tmpdir(), 'theme-id-'));
    writeFileSync(
      join(themeDir, 'package.json'),
      JSON.stringify({ name: '@bermooda/theme-paper' })
    );
    expect(detectPackageId(themeDir, 'theme')).toBe('paper');

    const pluginDir = mkdtempSync(join(tmpdir(), 'plugin-id-'));
    writeFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({ name: '@bermooda/plugin-subscriptions' })
    );
    expect(detectPackageId(pluginDir, 'plugin')).toBe('subscriptions');

    rmSync(themeDir, { recursive: true, force: true });
    rmSync(pluginDir, { recursive: true, force: true });
  });
});
