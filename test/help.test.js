import { afterEach, describe, expect, it, vi } from 'vitest';

import { helpCommand } from '../src/commands/help.js';

describe('helpCommand', () => {
  let logSpy;

  afterEach(() => {
    logSpy?.mockRestore();
  });

  it('prints global help by default', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({});
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/bermooda/);
    expect(text).toMatch(/install/);
    expect(text).toMatch(/dev-setup/);
    expect(text).toMatch(/plugin/);
    expect(text).toMatch(/mcp/);
    expect(text).toMatch(/dev/);
  });

  it('prints install topic help', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'install' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/--local/);
    expect(text).toMatch(/--admin-email/);
    expect(text).toMatch(/bermooda@latest/);
    expect(text).not.toMatch(/or main/);
  });

  it('prints dev-setup topic help', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'dev-setup' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/Contributor setup/);
    expect(text).toMatch(/theme-default/);
    expect(text).toMatch(/plugin-meilisearch/);
    expect(text).toMatch(/plugin-resend/);
    expect(text).toMatch(/--force/);
  });

  it('prints mcp topic help', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'mcp' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/mcp init/);
    expect(text).toMatch(/--url/);
    expect(text).toMatch(/bootstrap-api-key/);
  });

  it('mentions unknown topics', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'not-a-command' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/Unknown help topic/);
    expect(text).toMatch(/Commands:/);
  });
});
