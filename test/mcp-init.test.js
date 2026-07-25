import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mcpInit } from '../src/commands/mcp/init.js';
import { BOOTSTRAP_API_KEY_FILE, EXIT } from '../src/lib/constants.js';
import { createFixtureShop } from './helpers.js';

describe('mcpInit', () => {
  let exitSpy;
  let logSpy;
  let errorSpy;
  /** @type {string | undefined} */
  let savedApiKey;

  beforeEach(() => {
    savedApiKey = process.env.BERMOODA_API_KEY;
    delete process.env.BERMOODA_API_KEY;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (savedApiKey === undefined) {
      delete process.env.BERMOODA_API_KEY;
    } else {
      process.env.BERMOODA_API_KEY = savedApiKey;
    }
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writes MCP config from shop .env', async () => {
    const shop = createFixtureShop();
    writeFileSync(
      join(shop, '.env'),
      'BERMOODA_URL=https://shop.example\nBERMOODA_API_KEY=berm_from_env\n'
    );

    await mcpInit({ cwd: shop });

    const config = JSON.parse(
      readFileSync(join(shop, '.cursor', 'mcp.json'), 'utf8')
    );
    expect(config.mcpServers.bermooda).toEqual({
      command: 'npx',
      args: ['-y', 'bermooda-mcp'],
      env: {
        BERMOODA_URL: 'https://shop.example',
        BERMOODA_API_KEY: 'berm_from_env',
      },
    });
    expect(logSpy.mock.calls.map((c) => c[0]).join('\n')).toMatch(
      /Claude Desktop/
    );
  });

  it('reads API key from bootstrap-api-key file when not in .env', async () => {
    const shop = createFixtureShop();
    mkdirSync(join(shop, '.bermooda'), { recursive: true });
    writeFileSync(join(shop, BOOTSTRAP_API_KEY_FILE), 'berm_bootstrap_key\n');

    await mcpInit({ cwd: shop, url: 'http://localhost:4000' });

    const config = JSON.parse(
      readFileSync(join(shop, '.cursor', 'mcp.json'), 'utf8')
    );
    expect(config.mcpServers.bermooda.env.BERMOODA_URL).toBe(
      'http://localhost:4000'
    );
    expect(config.mcpServers.bermooda.env.BERMOODA_API_KEY).toBe(
      'berm_bootstrap_key'
    );
  });

  it('merges bermooda into existing mcp.json', async () => {
    const shop = createFixtureShop();
    writeFileSync(join(shop, '.env'), 'BERMOODA_API_KEY=berm_merge\n');
    mkdirSync(join(shop, '.cursor'), { recursive: true });
    writeFileSync(
      join(shop, '.cursor', 'mcp.json'),
      `${JSON.stringify(
        {
          mcpServers: {
            other: { command: 'node', args: ['other.js'] },
            bermooda: {
              command: 'npx',
              args: ['-y', 'bermooda-mcp'],
              env: { BERMOODA_URL: 'http://old', BERMOODA_API_KEY: 'old' },
            },
          },
        },
        null,
        2
      )}\n`
    );

    await mcpInit({ cwd: shop, url: 'http://localhost:3000' });

    const config = JSON.parse(
      readFileSync(join(shop, '.cursor', 'mcp.json'), 'utf8')
    );
    expect(config.mcpServers.other).toEqual({
      command: 'node',
      args: ['other.js'],
    });
    expect(config.mcpServers.bermooda.env).toEqual({
      BERMOODA_URL: 'http://localhost:3000',
      BERMOODA_API_KEY: 'berm_merge',
    });
  });

  it('exits when no API key is available', async () => {
    const shop = createFixtureShop();

    await expect(mcpInit({ cwd: shop })).rejects.toThrow(`exit:${EXIT.USER}`);
    const errorText = errorSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');
    expect(errorText).toMatch(/No API key found/);
  });

  it('prints json output without exposing the key', async () => {
    const shop = createFixtureShop();
    writeFileSync(
      join(shop, '.env'),
      'BERMOODA_API_KEY=berm_secret_key\nBERMOODA_URL=http://localhost:3000\n'
    );

    await mcpInit({ cwd: shop, json: true });

    const jsonLine = logSpy.mock.calls
      .map((call) => call[0])
      .find((line) => typeof line === 'string' && line.startsWith('{'));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(/** @type {string} */ (jsonLine));
    expect(parsed).toEqual({
      url: 'http://localhost:3000',
      keyPresent: true,
      path: join(shop, '.cursor', 'mcp.json'),
    });
    expect(jsonLine).not.toContain('berm_secret_key');
  });

  it('requires --force when existing mcp.json is invalid', async () => {
    const shop = createFixtureShop();
    writeFileSync(join(shop, '.env'), 'BERMOODA_API_KEY=berm_force\n');
    mkdirSync(join(shop, '.cursor'), { recursive: true });
    writeFileSync(join(shop, '.cursor', 'mcp.json'), '{not-json');

    await expect(mcpInit({ cwd: shop })).rejects.toThrow(`exit:${EXIT.USER}`);

    await mcpInit({ cwd: shop, force: true });
    const config = JSON.parse(
      readFileSync(join(shop, '.cursor', 'mcp.json'), 'utf8')
    );
    expect(config.mcpServers.bermooda.env.BERMOODA_API_KEY).toBe('berm_force');
  });
});
