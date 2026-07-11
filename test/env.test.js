import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildEnvFile,
  defaultEnvOverrides,
  parseEnvExample,
  quoteEnvValue,
  randomSecret,
  readEnvExample,
  writeEnvFile,
} from '../src/lib/env.js';

describe('quoteEnvValue', () => {
  it('quotes values with spaces', () => {
    expect(quoteEnvValue('hello world')).toBe('"hello world"');
  });

  it('quotes empty strings', () => {
    expect(quoteEnvValue('')).toBe('""');
  });

  it('leaves simple tokens unquoted', () => {
    expect(quoteEnvValue('plain')).toBe('plain');
    expect(quoteEnvValue('file:./prisma/dev.db')).toBe('file:./prisma/dev.db');
  });

  it('escapes embedded quotes', () => {
    expect(quoteEnvValue('say "hi"')).toBe('"say \\"hi\\""');
  });
});

describe('parseEnvExample', () => {
  it('preserves comments and blank lines', () => {
    const lines = parseEnvExample('# header\n\nFOO=bar\n');
    expect(lines[0]).toEqual({ key: null, line: '# header' });
    expect(lines[1]).toEqual({ key: null, line: '' });
    expect(lines[2].key).toBe('FOO');
    expect(lines[2].value).toBe('bar');
  });

  it('strips surrounding quotes from values', () => {
    const lines = parseEnvExample(`A="quoted"\nB='single'\n`);
    expect(lines[0].value).toBe('quoted');
    expect(lines[1].value).toBe('single');
  });
});

describe('buildEnvFile', () => {
  it('merges overrides into example and preserves comments', () => {
    const example = `DATABASE_URL="file:./prisma/dev.db"
# comment
BETTER_AUTH_SECRET=old
`;
    const out = buildEnvFile(example, {
      BETTER_AUTH_SECRET: 'newsecret',
      HEALTH_TOKEN: 'abc',
    });
    expect(out).toMatch(/BETTER_AUTH_SECRET=newsecret/);
    expect(out).toMatch(/HEALTH_TOKEN=abc/);
    expect(out).toMatch(/DATABASE_URL=/);
    expect(out).toMatch(/# comment/);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('appends keys not present in the example', () => {
    const out = buildEnvFile('A=1\n', { B: 'two' });
    expect(out).toMatch(/^A=1$/m);
    expect(out).toMatch(/^B=two$/m);
  });
});

describe('randomSecret / defaultEnvOverrides', () => {
  it('generates 64-char hex secrets', () => {
    const s = randomSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(randomSecret()).not.toBe(s);
  });

  it('local mode defaults to sqlite file URL', () => {
    const o = defaultEnvOverrides('local');
    expect(o.DATABASE_URL).toBe('file:./prisma/dev.db');
    expect(o.DATABASE_PROVIDER).toBeUndefined();
    expect(o.BETTER_AUTH_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(o.HEALTH_TOKEN).toMatch(/^[0-9a-f]{64}$/);
    expect(o.QUEUE_DATABASE_PATH).toBe('./prisma/queue.db');
  });

  it('server mode sets postgresql provider', () => {
    const o = defaultEnvOverrides('server', {
      databaseUrl: 'postgresql://localhost/shop',
    });
    expect(o.DATABASE_URL).toBe('postgresql://localhost/shop');
    expect(o.DATABASE_PROVIDER).toBe('postgresql');
  });
});

describe('writeEnvFile / readEnvExample', () => {
  let exitSpy;

  afterEach(() => {
    exitSpy?.mockRestore();
  });

  it('writes .env atomically', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-write-'));
    writeEnvFile(root, 'FOO=bar\n');
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('FOO=bar\n');
    expect(existsSync(join(root, `.env.${process.pid}.tmp`))).toBe(false);
  });

  it('refuses overwrite without force', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-noforce-'));
    writeFileSync(join(root, '.env'), 'OLD=1\n');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    expect(() => writeEnvFile(root, 'NEW=1\n')).toThrow(/exit:1/);
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('OLD=1\n');
  });

  it('overwrites with force', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-force-'));
    writeFileSync(join(root, '.env'), 'OLD=1\n');
    writeEnvFile(root, 'NEW=1\n', { force: true });
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('NEW=1\n');
  });

  it('reads .env.example when present', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-ex-'));
    writeFileSync(join(root, '.env.example'), 'FROM_EXAMPLE=1\n');
    expect(readEnvExample(root)).toBe('FROM_EXAMPLE=1\n');
  });

  it('returns minimal template when example missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-min-'));
    expect(readEnvExample(root)).toMatch(/DATABASE_URL=/);
    expect(readEnvExample(root)).toMatch(/BETTER_AUTH_SECRET=/);
  });
});
