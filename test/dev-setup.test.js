import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_REPO,
  CONTRIBUTOR_EXTENSIONS,
  EXIT,
  PROJECT_JSON,
} from '../src/lib/constants.js';

const gitCloneMock = vi.fn();
const npmMock = vi.fn();
const setupDatabaseMock = vi.fn();
const bootstrapShopMock = vi.fn();
const setShopExtensionsMock = vi.fn();

vi.mock('../src/lib/git-clone.js', () => ({
  gitClone: (...args) => gitCloneMock(...args),
}));

vi.mock('../src/lib/process.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    npm: (...args) => npmMock(...args),
    loadShopEnv: () => ({ PATH: '/usr/bin' }),
  };
});

vi.mock('../src/lib/db.js', () => ({
  setupDatabase: (...args) => setupDatabaseMock(...args),
}));

vi.mock('../src/lib/bootstrap.js', () => ({
  bootstrapShop: (...args) => bootstrapShopMock(...args),
}));

vi.mock('../src/lib/extensions-settings.js', () => ({
  setShopExtensions: (...args) => setShopExtensionsMock(...args),
}));

const { devSetupCommand } = await import('../src/commands/dev-setup.js');

/**
 * @param {string} dest
 */
function seedMinimalAppTree(dest) {
  mkdirSync(join(dest, 'app', 'themes'), { recursive: true });
  mkdirSync(join(dest, 'app', 'plugins'), { recursive: true });
  mkdirSync(join(dest, 'prisma'), { recursive: true });
  writeFileSync(
    join(dest, 'package.json'),
    JSON.stringify(
      { name: 'bermooda', version: '1.0.0', private: true },
      null,
      2
    )
  );
  writeFileSync(join(dest, 'prisma', 'schema.prisma'), 'datasource db {}\n');
  writeFileSync(
    join(dest, '.env.example'),
    'DATABASE_URL="file:./prisma/dev.db"\nBETTER_AUTH_SECRET=change-me\n'
  );
}

describe('devSetupCommand', () => {
  let exitSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    gitCloneMock.mockReset();
    npmMock.mockReset();
    setupDatabaseMock.mockReset();
    bootstrapShopMock.mockReset();
    setShopExtensionsMock.mockReset();

    gitCloneMock.mockImplementation(async ({ dest, url }) => {
      if (url === APP_REPO) {
        seedMinimalAppTree(dest);
      } else {
        mkdirSync(dest, { recursive: true });
        writeFileSync(join(dest, 'package.json'), '{}\n');
      }
    });
    npmMock.mockResolvedValue(0);
    setupDatabaseMock.mockResolvedValue(undefined);
    bootstrapShopMock.mockResolvedValue(undefined);
    setShopExtensionsMock.mockResolvedValue(undefined);

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

  it('clones app + contributor extensions then bootstraps', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'bermooda-dev-setup-'));
    const targetDir = join(parent, 'shop');

    await devSetupCommand({
      yes: true,
      local: true,
      dir: targetDir,
      adminEmail: 'dev@example.com',
      adminPassword: 'secret123!',
      storeName: 'Dev Shop',
      noInteractive: true,
    });

    expect(gitCloneMock).toHaveBeenCalledTimes(
      1 + CONTRIBUTOR_EXTENSIONS.length
    );
    expect(gitCloneMock.mock.calls[0][0]).toMatchObject({
      url: APP_REPO,
      dest: targetDir,
    });

    for (const ext of CONTRIBUTOR_EXTENSIONS) {
      const dest =
        ext.kind === 'plugin'
          ? join(targetDir, 'app', 'plugins', ext.slug)
          : join(targetDir, 'app', 'themes', ext.slug);
      expect(gitCloneMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: ext.repo,
          dest,
          label: ext.packageId,
        })
      );
    }

    expect(npmMock).toHaveBeenCalledWith(targetDir, ['install']);
    expect(setupDatabaseMock).toHaveBeenCalledWith(targetDir, {
      provider: 'sqlite',
    });
    expect(bootstrapShopMock).toHaveBeenCalledWith(
      targetDir,
      expect.objectContaining({
        adminEmail: 'dev@example.com',
        adminPassword: 'secret123!',
        storeName: 'Dev Shop',
      })
    );
    expect(setShopExtensionsMock).toHaveBeenCalledWith(targetDir, {
      activeTheme: '@bermooda/theme-default',
      enabledPlugins: [
        '@bermooda/plugin-meilisearch',
        '@bermooda/plugin-resend',
      ],
    });

    const project = JSON.parse(
      readFileSync(join(targetDir, PROJECT_JSON), 'utf8')
    );
    expect(project.method).toBe('dev-setup');
    expect(project.installMode).toBe('local');
  });

  it('passes --ref to the app clone only', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'bermooda-dev-setup-'));
    const targetDir = join(parent, 'shop');

    await devSetupCommand({
      yes: true,
      local: true,
      dir: targetDir,
      ref: 'master',
      skipDeps: true,
      skipDb: true,
      noInteractive: true,
    });

    expect(gitCloneMock.mock.calls[0][0].ref).toBe('master');
    for (let i = 1; i < gitCloneMock.mock.calls.length; i++) {
      expect(gitCloneMock.mock.calls[i][0].ref).toBeUndefined();
    }
    expect(npmMock).not.toHaveBeenCalled();
    expect(setShopExtensionsMock).not.toHaveBeenCalled();
  });

  it('rejects non-empty target without --force', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'bermooda-dev-setup-'));
    const targetDir = join(parent, 'shop');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'keep.txt'), 'x\n');

    await expect(
      devSetupCommand({
        yes: true,
        dir: targetDir,
        noInteractive: true,
      })
    ).rejects.toThrow(`exit:${EXIT.USER}`);

    expect(gitCloneMock).not.toHaveBeenCalled();
  });
});
