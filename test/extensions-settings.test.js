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
    loadShopEnv: () => ({ PATH: '/usr/bin', DATABASE_URL: 'file:./prisma/dev.db' }),
  };
});

// Import after mock so setShopExtensions uses mocked run
const { setShopExtensions } = await import('../src/lib/extensions-settings.js');

describe('setShopExtensions', () => {
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

  it('warns and no-ops when script is missing', async () => {
    const shop = createFixtureShop();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await setShopExtensions(shop, { activeTheme: '@bermooda/theme-default' });

    expect(runMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('runs script with BERMOODA_ACTIVE_THEME', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-set-extensions.mjs'), '// stub\n');
    runMock.mockResolvedValue(0);

    await setShopExtensions(shop, { activeTheme: '@bermooda/theme-default' });

    expect(runMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = runMock.mock.calls[0];
    expect(cmd).toBe('node');
    expect(args[0]).toMatch(/cli-set-extensions\.mjs$/);
    expect(opts.cwd).toBe(shop);
    expect(opts.env.BERMOODA_ACTIVE_THEME).toBe('@bermooda/theme-default');
    expect(opts.env.BERMOODA_ENABLED_PLUGINS).toBeUndefined();
    expect(opts.env.BERMOODA_ENABLE_PLUGIN).toBeUndefined();
  });

  it('runs script with BERMOODA_ENABLED_PLUGINS as comma-joined string', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-set-extensions.mjs'), '// stub\n');
    runMock.mockResolvedValue(0);

    await setShopExtensions(shop, {
      enabledPlugins: ['@bermooda/meilisearch', '@bermooda/plugin-resend'],
    });

    const [, , opts] = runMock.mock.calls[0];
    expect(opts.env.BERMOODA_ENABLED_PLUGINS).toBe(
      '@bermooda/meilisearch,@bermooda/plugin-resend'
    );
    expect(opts.env.BERMOODA_ACTIVE_THEME).toBeUndefined();
    expect(opts.env.BERMOODA_ENABLE_PLUGIN).toBeUndefined();
  });

  it('runs script with BERMOODA_ENABLE_PLUGIN for single-append', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-set-extensions.mjs'), '// stub\n');
    runMock.mockResolvedValue(0);

    await setShopExtensions(shop, { enablePlugin: '@bermooda/plugin-resend' });

    const [, , opts] = runMock.mock.calls[0];
    expect(opts.env.BERMOODA_ENABLE_PLUGIN).toBe('@bermooda/plugin-resend');
    expect(opts.env.BERMOODA_ACTIVE_THEME).toBeUndefined();
    expect(opts.env.BERMOODA_ENABLED_PLUGINS).toBeUndefined();
  });

  it('can set all three env vars simultaneously', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-set-extensions.mjs'), '// stub\n');
    runMock.mockResolvedValue(0);

    await setShopExtensions(shop, {
      activeTheme: '@bermooda/theme-default',
      enabledPlugins: ['@bermooda/meilisearch'],
      enablePlugin: '@bermooda/plugin-resend',
    });

    const [, , opts] = runMock.mock.calls[0];
    expect(opts.env.BERMOODA_ACTIVE_THEME).toBe('@bermooda/theme-default');
    expect(opts.env.BERMOODA_ENABLED_PLUGINS).toBe('@bermooda/meilisearch');
    expect(opts.env.BERMOODA_ENABLE_PLUGIN).toBe('@bermooda/plugin-resend');
  });

  it(`exits with ${EXIT.USER} when script fails`, async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, 'scripts'), { recursive: true });
    writeFileSync(join(shop, 'scripts', 'cli-set-extensions.mjs'), '// stub\n');
    runMock.mockResolvedValue(1);

    await expect(
      setShopExtensions(shop, { activeTheme: '@bermooda/theme-default' })
    ).rejects.toThrow(`exit:${EXIT.USER}`);
  });
});
