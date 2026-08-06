import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildBermoodaConfigSource,
  writeBermoodaConfig,
} from '../src/lib/bermooda-config.js';

/** @type {string[]} */
const temps = [];

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildBermoodaConfigSource', () => {
  it('includes baseUrl when provided', () => {
    const src = buildBermoodaConfigSource({
      baseUrl: 'https://shop.example.com/',
      fromNoReply: 'Shop <noreply@shop.example.com>',
    });
    expect(src).toContain("baseUrl: 'https://shop.example.com'");
    expect(src).toContain("fromNoReply: 'Shop <noreply@shop.example.com>'");
    expect(src).toContain('export default config');
  });

  it('comments baseUrl when omitted (dev-setup)', () => {
    const src = buildBermoodaConfigSource({
      fromNoReply: 'bermooda <noreply@example.com>',
    });
    expect(src).toContain("// baseUrl: 'https://shop.example.com'");
    expect(src).not.toMatch(/^\s*baseUrl:/m);
  });

  it('escapes single quotes in values', () => {
    const src = buildBermoodaConfigSource({
      baseUrl: "https://o'hare.example",
      fromNoReply: "Shop <no'reply@example.com>",
    });
    expect(src).toContain("baseUrl: 'https://o\\'hare.example'");
    expect(src).toContain("fromNoReply: 'Shop <no\\'reply@example.com>'");
  });

  it('rejects empty fromNoReply', () => {
    expect(() => buildBermoodaConfigSource({ fromNoReply: '  ' })).toThrow(
      /fromNoReply is required/
    );
  });
});

describe('writeBermoodaConfig', () => {
  it('writes bermooda.config.js into the shop root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'berm-cfg-'));
    temps.push(dir);
    writeBermoodaConfig(dir, {
      baseUrl: 'http://localhost:3000',
      fromNoReply: 'bermooda <noreply@example.com>',
    });
    const written = readFileSync(join(dir, 'bermooda.config.js'), 'utf8');
    expect(written).toContain("baseUrl: 'http://localhost:3000'");
  });
});
