import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pluginRemove } from '../src/commands/plugin/index.js';
import { createFixtureShop } from './helpers.js';

describe('pluginRemove', () => {
  let exitSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('removes the plugin directory and logs a deps note', async () => {
    const shop = createFixtureShop();
    const dest = join(shop, 'app', 'plugins', 'resend');
    mkdirSync(dest, { recursive: true });

    await pluginRemove({ cwd: shop, name: 'resend' });

    expect(existsSync(dest)).toBe(false);
    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('Removed plugin resend');
    expect(output).toContain('npm dependencies were not removed');
  });
});
