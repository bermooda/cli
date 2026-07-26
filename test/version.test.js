import { afterEach, describe, expect, it, vi } from 'vitest';

import { versionCommand } from '../src/commands/version.js';
import { getCliVersion } from '../src/lib/package-json.js';
import { createFixtureShop } from './helpers.js';

describe('versionCommand', () => {
  let logSpy;

  afterEach(() => {
    logSpy?.mockRestore();
  });

  it('prints CLI version only with --cli', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await versionCommand({ cli: true });
    expect(logSpy).toHaveBeenCalledWith(`@bermooda/cli ${getCliVersion()}`);
  });

  it('reports missing shop with --shop outside a shop', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const notShop = createFixtureShop({ name: 'other' });
    await versionCommand({ shop: true, cwd: notShop });
    expect(logSpy.mock.calls.flat().join('\n')).toMatch(/not in a shop/i);
  });

  it('includes shop version and meta as JSON', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const shop = createFixtureShop({
      version: '9.9.9',
      withEnv: true,
      withMeta: { sourceRef: 'v1.2.3', installMode: 'local' },
    });
    await versionCommand({ json: true, cwd: shop });
    const payload = JSON.parse(logSpy.mock.calls[0][0]);
    expect(payload.cli).toBe(getCliVersion());
    expect(payload.shop.version).toBe('9.9.9');
    expect(payload.shop.sourceRef).toBe('v1.2.3');
    expect(payload.shop.hasEnv).toBe(true);
    expect(payload.shop.root).toBe(shop);
  });

  it('shop-only JSON omits cli when --shop without --cli', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const shop = createFixtureShop({ version: '2.0.0' });
    await versionCommand({ shop: true, json: true, cwd: shop });
    const payload = JSON.parse(logSpy.mock.calls[0][0]);
    expect(payload.cli).toBeUndefined();
    expect(payload.shop.version).toBe('2.0.0');
  });
});
