import { describe, expect, it, vi } from 'vitest';

import {
  assertEngineCompatible,
  evaluateEngineCompatibility,
} from '../src/lib/engine.js';

describe('evaluateEngineCompatibility', () => {
  it('is ok when the shop version satisfies the engine range', () => {
    expect(
      evaluateEngineCompatibility({
        shopVersion: '1.2.3',
        engine: '>=1.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      })
    ).toEqual({ ok: true });
  });

  it('fails with a descriptive message when the engine is missing', () => {
    const result = evaluateEngineCompatibility({
      shopVersion: '1.0.0',
      engine: undefined,
      kind: 'plugin',
      id: 'fraud-guard',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/"bermooda\.engine"/);
    expect(result.message).toMatch(/Plugin "fraud-guard"/);
  });

  it('fails with a descriptive message when the engine range is invalid', () => {
    const result = evaluateEngineCompatibility({
      shopVersion: '1.0.0',
      engine: 'not-a-range',
      kind: 'theme',
      id: 'paper',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Theme "paper"/);
    expect(result.message).toMatch(/valid semver range/);
  });

  it('fails when the shop version does not satisfy the engine range', () => {
    const result = evaluateEngineCompatibility({
      shopVersion: '1.0.0',
      engine: '>=2.0.0',
      kind: 'plugin',
      id: 'fraud-guard',
    });
    expect(result).toEqual({
      ok: false,
      message: 'Plugin "fraud-guard" requires bermooda >=2.0.0 (shop is 1.0.0)',
    });
  });

  it('formats theme mismatches with the theme label', () => {
    const result = evaluateEngineCompatibility({
      shopVersion: '1.0.0',
      engine: '>=2.0.0',
      kind: 'theme',
      id: 'paper',
    });
    expect(result).toEqual({
      ok: false,
      message: 'Theme "paper" requires bermooda >=2.0.0 (shop is 1.0.0)',
    });
  });

  it('fails when the shop version is missing or invalid', () => {
    expect(
      evaluateEngineCompatibility({
        shopVersion: undefined,
        engine: '>=1.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      })
    ).toEqual({
      ok: false,
      message: 'Shop package.json must declare a valid semver "version"',
    });

    expect(
      evaluateEngineCompatibility({
        shopVersion: 'not-a-version',
        engine: '>=1.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      }).ok
    ).toBe(false);
  });
});

describe('assertEngineCompatible', () => {
  it('does not exit when compatible', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('should not exit');
    });
    expect(() =>
      assertEngineCompatible({
        shopVersion: '1.0.0',
        engine: '>=1.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      })
    ).not.toThrow();
    exitSpy.mockRestore();
  });

  it('logs the error and exits with EXIT.USER on mismatch', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    expect(() =>
      assertEngineCompatible({
        shopVersion: '1.0.0',
        engine: '>=2.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      })
    ).toThrow(/exit:1/);
    exitSpy.mockRestore();
  });
});
