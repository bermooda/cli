import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertInside,
  detectPackageId,
  installFromPath,
  listInstalled,
  validatePackageShape,
} from '../src/lib/fs-install.js';
import { createFixturePlugin, createFixtureShop } from './helpers.js';

describe('assertInside (zip-slip)', () => {
  it('allows paths under base including the base itself', () => {
    const base = mkdtempSync(join(tmpdir(), 'zip-ok-'));
    expect(() => assertInside(base, join(base, 'a', 'b'))).not.toThrow();
    expect(() => assertInside(base, base)).not.toThrow();
  });

  it('rejects paths outside base', () => {
    const base = mkdtempSync(join(tmpdir(), 'zip-base-'));
    const outside = mkdtempSync(join(tmpdir(), 'zip-out-'));
    expect(() => assertInside(base, join(outside, 'evil'))).toThrow(
      /outside target/
    );
  });
});

describe('validatePackageShape', () => {
  it('accepts plugin with manifest.js', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-shape-'));
    writeFileSync(join(dir, 'manifest.js'), "export default { id: 'x' };");
    expect(validatePackageShape(dir, 'plugin').ok).toBe(true);
  });

  it('accepts plugin with only index.server.js', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-idx-'));
    writeFileSync(join(dir, 'index.server.js'), 'export default {};');
    expect(validatePackageShape(dir, 'plugin').ok).toBe(true);
  });

  it('rejects empty plugin', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-empty-'));
    expect(validatePackageShape(dir, 'plugin').ok).toBe(false);
  });

  it('rejects empty theme directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-empty-'));
    expect(validatePackageShape(dir, 'theme').ok).toBe(false);
  });

  it('accepts theme with files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-ok-'));
    writeFileSync(join(dir, 'index.jsx'), 'export default null;');
    expect(validatePackageShape(dir, 'theme').ok).toBe(true);
  });
});

describe('detectPackageId', () => {
  it('prefers bermooda.slug over bermooda.id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-slug-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', bermooda: { slug: 'my-slug', id: 'my-id' } })
    );
    expect(detectPackageId(dir, 'plugin')).toBe('my-slug');
  });

  it('prefers bermooda.slug over name-based derivation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-slug-name-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@bermooda/plugin-other', bermooda: { slug: 'my-slug' } })
    );
    expect(detectPackageId(dir, 'plugin')).toBe('my-slug');
  });

  it('reads bermooda.id from package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-id-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', bermooda: { id: 'my-plugin' } })
    );
    expect(detectPackageId(dir, 'plugin')).toBe('my-plugin');
  });

  it('falls back to package name slug', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-name-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@org/cool-thing' })
    );
    expect(detectPackageId(dir, 'plugin')).toBe('cool-thing');
  });

  it('reads id from manifest.js', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-man-'));
    writeFileSync(
      join(dir, 'manifest.js'),
      "export default { id: 'from-manifest' };"
    );
    expect(detectPackageId(dir, 'plugin')).toBe('from-manifest');
  });
});

describe('installFromPath + listInstalled', () => {
  let exitSpy;

  afterEach(() => {
    exitSpy?.mockRestore();
  });

  it('installs plugin and lists version from manifest', () => {
    const shop = createFixtureShop();
    const pluginSrc = createFixturePlugin('demo-plugin');
    writeFileSync(
      join(pluginSrc, 'manifest.js'),
      "export default { id: 'demo-plugin', version: '1.2.3' };"
    );

    installFromPath({
      shopRoot: shop,
      kind: 'plugin',
      id: 'demo-plugin',
      sourceDir: pluginSrc,
    });

    const dest = join(shop, 'app', 'plugins', 'demo-plugin', 'manifest.js');
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, 'utf8')).toMatch(/demo-plugin/);

    const list = listInstalled(shop, 'plugin');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('demo-plugin');
    expect(list[0].version).toBe('1.2.3');
  });

  it('backs up existing package on replace', () => {
    const shop = createFixtureShop();
    const v1 = createFixturePlugin('demo-plugin');
    writeFileSync(join(v1, 'marker.txt'), 'v1');
    installFromPath({
      shopRoot: shop,
      kind: 'plugin',
      id: 'demo-plugin',
      sourceDir: v1,
    });

    const v2 = createFixturePlugin('demo-plugin');
    writeFileSync(join(v2, 'marker.txt'), 'v2');
    installFromPath({
      shopRoot: shop,
      kind: 'plugin',
      id: 'demo-plugin',
      sourceDir: v2,
      replace: true,
    });

    expect(
      readFileSync(
        join(shop, 'app', 'plugins', 'demo-plugin', 'marker.txt'),
        'utf8'
      )
    ).toBe('v2');

    const backups = join(shop, '.bermooda', 'backups', 'plugins');
    expect(existsSync(backups)).toBe(true);
    const dirs = readdirSync(backups);
    expect(dirs.some((d) => d.startsWith('demo-plugin-'))).toBe(true);
  });

  it('refuses invalid ids', () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const shop = createFixtureShop();
    const src = createFixturePlugin('x');
    expect(() =>
      installFromPath({
        shopRoot: shop,
        kind: 'plugin',
        id: 'Bad_ID',
        sourceDir: src,
      })
    ).toThrow(/exit:1/);
  });

  it('refuses install when destination exists without replace', () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const shop = createFixtureShop();
    const src = createFixturePlugin('dup');
    installFromPath({
      shopRoot: shop,
      kind: 'plugin',
      id: 'dup',
      sourceDir: src,
    });
    // restore exit after first success — re-install fails
    expect(() =>
      installFromPath({
        shopRoot: shop,
        kind: 'plugin',
        id: 'dup',
        sourceDir: src,
        replace: false,
      })
    ).toThrow(/exit:1/);
  });

  it('lists themes from filesystem', () => {
    const shop = createFixtureShop();
    const themes = listInstalled(shop, 'theme');
    expect(themes.map((t) => t.id)).toContain('default');
  });
});
