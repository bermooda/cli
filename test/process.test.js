import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  detectPackageManager,
  loadShopEnv,
  readTextIfExists,
  run,
} from '../src/lib/process.js';

describe('loadShopEnv', () => {
  it('returns process env when .env is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'no-env-'));
    const env = loadShopEnv(root);
    expect(env.PATH).toBe(process.env.PATH);
  });

  it('merges .env over process env without mutating process.env', () => {
    const root = mkdtempSync(join(tmpdir(), 'with-env-'));
    writeFileSync(
      join(root, '.env'),
      'BETTER_AUTH_SECRET=from-file\nCUSTOM_FLAG=1\n'
    );
    const before = process.env.BETTER_AUTH_SECRET;
    const env = loadShopEnv(root);
    expect(env.BETTER_AUTH_SECRET).toBe('from-file');
    expect(env.CUSTOM_FLAG).toBe('1');
    expect(process.env.BETTER_AUTH_SECRET).toBe(before);
  });
});

describe('detectPackageManager', () => {
  const original = process.env.npm_config_user_agent;

  afterEach(() => {
    if (original === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = original;
  });

  it('defaults to npm', () => {
    delete process.env.npm_config_user_agent;
    expect(detectPackageManager()).toBe('npm');
  });

  it('detects pnpm and yarn from user agent', () => {
    process.env.npm_config_user_agent = 'pnpm/9.0.0 npm/? node/v22';
    expect(detectPackageManager()).toBe('pnpm');
    process.env.npm_config_user_agent = 'yarn/1.22.0 npm/? node/v22';
    expect(detectPackageManager()).toBe('yarn');
  });
});

describe('readTextIfExists / run', () => {
  it('reads existing files and returns null otherwise', () => {
    const root = mkdtempSync(join(tmpdir(), 'read-'));
    writeFileSync(join(root, 'a.txt'), 'hello');
    expect(readTextIfExists(join(root, 'a.txt'))).toBe('hello');
    expect(readTextIfExists(join(root, 'missing.txt'))).toBe(null);
  });

  it('runs a simple command and returns exit code', async () => {
    const code = await run(process.execPath, ['-e', 'process.exit(0)'], {
      silent: true,
    });
    expect(code).toBe(0);
  });

  it('returns 127 for missing binaries', async () => {
    const code = await run('bermooda-cli-no-such-binary-xyz', [], {
      silent: true,
    });
    expect(code).toBe(127);
  });
});
