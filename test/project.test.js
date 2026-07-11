import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BERMOODA_DIR } from '../src/lib/constants.js';
import {
  assertInShop,
  findProjectRoot,
  isShopRoot,
  readProjectMeta,
  shopMetaDir,
} from '../src/lib/project.js';
import { createFixtureShop } from './helpers.js';

describe('project detection', () => {
  it('detects a valid shop root and walks up from nested dirs', () => {
    const root = createFixtureShop({ version: '0.0.0' });
    expect(isShopRoot(root)).toBe(true);
    expect(findProjectRoot(join(root, 'app', 'core'))).toBe(root);
  });

  it('rejects unrelated package names', () => {
    const root = createFixtureShop({ name: 'other' });
    expect(isShopRoot(root)).toBe(false);
    expect(findProjectRoot(root)).toBe(null);
  });

  it('requires prisma/schema.prisma', () => {
    const root = createFixtureShop();
    unlinkSync(join(root, 'prisma', 'schema.prisma'));
    expect(isShopRoot(root)).toBe(false);
  });

  it('reads project meta and shopMetaDir', () => {
    const root = createFixtureShop({
      withMeta: { sourceRef: 'v1.0.0', installMode: 'local' },
    });
    expect(readProjectMeta(root)).toEqual({
      sourceRef: 'v1.0.0',
      installMode: 'local',
    });
    expect(shopMetaDir(root)).toBe(join(root, BERMOODA_DIR));
  });

  it('returns null for missing or invalid project.json', () => {
    const root = createFixtureShop();
    expect(readProjectMeta(root)).toBe(null);

    mkdirSync(join(root, '.bermooda'), { recursive: true });
    writeFileSync(join(root, '.bermooda', 'project.json'), '{not-json');
    expect(readProjectMeta(root)).toBe(null);
  });
});

describe('assertInShop', () => {
  let exitSpy;

  afterEach(() => {
    exitSpy?.mockRestore();
  });

  it('returns shop root when inside a shop', () => {
    const root = createFixtureShop();
    expect(assertInShop(join(root, 'app'))).toBe(root);
  });

  it('exits with USER code when not in a shop', () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const notShop = createFixtureShop({ name: 'other' });
    expect(() => assertInShop(notShop)).toThrow(/exit:1/);
  });
});
