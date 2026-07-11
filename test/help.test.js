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
    expect(text).toMatch(/plugin/);
    expect(text).toMatch(/dev/);
  });

  it('prints install topic help', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'install' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/--local/);
    expect(text).toMatch(/--admin-email/);
  });

  it('mentions unknown topics', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await helpCommand({ command: 'not-a-command' });
    const text = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toMatch(/Unknown help topic/);
    expect(text).toMatch(/Commands:/);
  });
});
