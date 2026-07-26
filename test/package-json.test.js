import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getCliPackageJson,
  getCliVersion,
  mergeDependencies,
  readPackageJson,
} from '../src/lib/package-json.js';

describe('package-json helpers', () => {
  it('reads this CLI package version', () => {
    const pkg = getCliPackageJson();
    expect(pkg.name).toBe('@bermooda/cli');
    expect(getCliVersion()).toMatch(/^\d+\.\d+\.\d+/);
    expect(getCliVersion()).toBe(pkg.version);
  });

  it('readPackageJson returns null for missing package', () => {
    const root = mkdtempSync(join(tmpdir(), 'no-pkg-'));
    expect(readPackageJson(root)).toBe(null);
  });

  it('mergeDependencies writes combined deps', () => {
    const root = mkdtempSync(join(tmpdir(), 'merge-deps-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'bermooda', dependencies: { a: '1.0.0' } })
    );
    mergeDependencies(root, { b: '2.0.0', a: '1.1.0' });
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.dependencies).toEqual({ a: '1.1.0', b: '2.0.0' });
  });

  it('mergeDependencies can target devDependencies', () => {
    const root = mkdtempSync(join(tmpdir(), 'merge-dev-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'bermooda' })
    );
    mergeDependencies(root, { vitest: '^3.0.0' }, 'devDependencies');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.vitest).toBe('^3.0.0');
  });

  it('mergeDependencies throws without package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'merge-miss-'));
    expect(() => mergeDependencies(root, { x: '1' })).toThrow(
      /No package.json/
    );
  });
});
