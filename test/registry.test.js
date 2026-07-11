import { describe, expect, it } from 'vitest';

import { SAFE_ID_RE } from '../src/lib/constants.js';
import { resolvePackageFromRegistry } from '../src/lib/registry.js';

const sample = {
  schemaVersion: 1,
  packages: [
    {
      name: 'Sample Analytics',
      id: 'sample-analytics',
      type: 'plugin',
      latest: '1.0.0',
      versions: {
        '1.0.0': {
          tarball: 'https://example.com/sample-analytics-1.0.0.tgz',
        },
        '0.9.0': {
          tarball: 'https://example.com/sample-analytics-0.9.0.tgz',
        },
      },
    },
    {
      name: 'Ocean',
      id: 'ocean',
      type: 'theme',
      latest: '2.0.0',
      versions: {
        '2.0.0': { tarball: 'https://example.com/ocean-2.0.0.tgz' },
      },
    },
    {
      name: 'Bad HTTP',
      id: 'bad-http',
      type: 'plugin',
      latest: '1.0.0',
      versions: {
        '1.0.0': { tarball: 'http://insecure.example/pkg.tgz' },
      },
    },
  ],
};

describe('resolvePackageFromRegistry', () => {
  it('resolves by id and latest version', () => {
    const { pkg, version, meta } = resolvePackageFromRegistry(
      sample,
      'plugin',
      'sample-analytics'
    );
    expect(pkg.id).toBe('sample-analytics');
    expect(version).toBe('1.0.0');
    expect(meta.tarball).toBe('https://example.com/sample-analytics-1.0.0.tgz');
  });

  it('resolves by display name', () => {
    const { pkg } = resolvePackageFromRegistry(
      sample,
      'plugin',
      'Sample Analytics'
    );
    expect(pkg.id).toBe('sample-analytics');
  });

  it('resolves an explicit version', () => {
    const { version, meta } = resolvePackageFromRegistry(
      sample,
      'plugin',
      'sample-analytics',
      '0.9.0'
    );
    expect(version).toBe('0.9.0');
    expect(meta.tarball).toContain('0.9.0');
  });

  it('resolves themes by type', () => {
    const { pkg } = resolvePackageFromRegistry(sample, 'theme', 'ocean');
    expect(pkg.type).toBe('theme');
  });

  it('does not cross type boundaries', () => {
    expect(() => resolvePackageFromRegistry(sample, 'plugin', 'ocean')).toThrow(
      /Unknown plugin/
    );
  });

  it('rejects unknown packages', () => {
    expect(() => resolvePackageFromRegistry(sample, 'plugin', 'nope')).toThrow(
      /Unknown plugin/
    );
  });

  it('rejects missing versions', () => {
    expect(() =>
      resolvePackageFromRegistry(sample, 'plugin', 'sample-analytics', '9.9.9')
    ).toThrow(/Version 9.9.9/);
  });

  it('rejects non-HTTPS tarballs', () => {
    expect(() =>
      resolvePackageFromRegistry(sample, 'plugin', 'bad-http')
    ).toThrow(/HTTPS/);
  });
});

describe('SAFE_ID_RE', () => {
  it('accepts kebab-case ids', () => {
    expect(SAFE_ID_RE.test('sample-analytics')).toBe(true);
    expect(SAFE_ID_RE.test('a')).toBe(true);
    expect(SAFE_ID_RE.test('x12')).toBe(true);
  });

  it('rejects unsafe ids', () => {
    expect(SAFE_ID_RE.test('Bad_ID')).toBe(false);
    expect(SAFE_ID_RE.test('../evil')).toBe(false);
    expect(SAFE_ID_RE.test('has space')).toBe(false);
    expect(SAFE_ID_RE.test('')).toBe(false);
  });
});
