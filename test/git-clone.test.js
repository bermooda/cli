import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXIT } from '../src/lib/constants.js';

const runMock = vi.fn();

vi.mock('../src/lib/process.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    run: (...args) => runMock(...args),
  };
});

const { gitClone } = await import('../src/lib/git-clone.js');

describe('gitClone', () => {
  let exitSpy;
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    runMock.mockReset();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('runs full git clone without --depth', async () => {
    runMock.mockResolvedValue(0);

    await gitClone({
      url: 'https://github.com/bermooda/theme-default.git',
      dest: '/tmp/theme',
      label: '@bermooda/theme-default',
    });

    expect(runMock).toHaveBeenCalledWith('git', ['--version'], {
      silent: true,
    });
    expect(runMock).toHaveBeenCalledWith('git', [
      'clone',
      'https://github.com/bermooda/theme-default.git',
      '/tmp/theme',
    ]);
  });

  it('passes --branch when ref is set', async () => {
    runMock.mockResolvedValue(0);

    await gitClone({
      url: 'https://github.com/bermooda/bermooda.git',
      dest: '/tmp/app',
      ref: 'master',
      label: 'bermooda/bermooda',
    });

    expect(runMock).toHaveBeenCalledWith('git', [
      'clone',
      '--branch',
      'master',
      'https://github.com/bermooda/bermooda.git',
      '/tmp/app',
    ]);
  });

  it('exits NETWORK when clone fails', async () => {
    runMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(
      gitClone({
        url: 'https://github.com/bermooda/bermooda.git',
        dest: '/tmp/app',
      })
    ).rejects.toThrow(`exit:${EXIT.NETWORK}`);
  });

  it('exits USER when git is missing', async () => {
    runMock.mockResolvedValue(127);

    await expect(
      gitClone({
        url: 'https://github.com/bermooda/bermooda.git',
        dest: '/tmp/app',
      })
    ).rejects.toThrow(`exit:${EXIT.USER}`);
  });
});
