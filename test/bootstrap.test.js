import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXIT } from '../src/lib/constants.js';
import { createFixtureShop } from './helpers.js';

const runMock = vi.fn();

vi.mock('../src/lib/process.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    run: (...args) => runMock(...args),
    loadShopEnv: () => ({ PATH: '/usr/bin', EXISTING: '1' }),
  };
});

// Import after mock so bootstrap uses mocked run
const { bootstrapShop } = await import('../src/lib/bootstrap.js');

describe('bootstrapShop', () => {
  let exitSpy;

  beforeEach(() => {
    runMock.mockReset();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('prefers scripts/cli-bootstrap.mjs when present', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-bootstrap.mjs'), '// bootstrap\n');
    runMock.mockResolvedValue(0);

    await bootstrapShop(shop, {
      adminEmail: 'a@example.com',
      adminPassword: 'secret',
      storeName: 'Shop',
      minimal: true,
    });

    expect(runMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = runMock.mock.calls[0];
    expect(cmd).toBe('node');
    expect(args[0]).toMatch(/cli-bootstrap\.mjs$/);
    expect(opts.cwd).toBe(shop);
    expect(opts.env.SEED_ADMIN_EMAIL).toBe('a@example.com');
    expect(opts.env.SEED_ADMIN_PASSWORD).toBe('secret');
    expect(opts.env.SEED_SHOP_NAME).toBe('Shop');
    expect(opts.env.BERMOODA_MINIMAL_SEED).toBe('1');
    // Password must only travel via env, not command args
    expect(args.join(' ')).not.toContain('secret');
  });

  it('falls back to npm run seed without cli-bootstrap', async () => {
    const shop = createFixtureShop();
    runMock.mockResolvedValue(0);

    await bootstrapShop(shop, {
      adminEmail: 'a@example.com',
      adminPassword: 'secret',
      storeName: 'Shop',
    });

    expect(runMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = runMock.mock.calls[0];
    expect(cmd).toBe('npm');
    expect(args).toEqual(['run', 'seed']);
    expect(opts.env.SEED_ADMIN_EMAIL).toBe('a@example.com');
    expect(opts.env.BERMOODA_MINIMAL_SEED).toBeUndefined();
  });

  it('exits with DB code when bootstrap fails', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-bootstrap.mjs'), '// bootstrap\n');
    runMock.mockResolvedValue(1);

    await expect(
      bootstrapShop(shop, {
        adminEmail: 'a@example.com',
        adminPassword: 'secret',
        storeName: 'Shop',
      })
    ).rejects.toThrow(`exit:${EXIT.DB}`);
  });
});
