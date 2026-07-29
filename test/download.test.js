import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyLocalApp, downloadApp } from '../src/lib/download.js';

describe('copyLocalApp', () => {
  let exitSpy;

  afterEach(() => {
    exitSpy?.mockRestore();
  });

  it('copies source and skips node_modules, .env, and db files', () => {
    const source = mkdtempSync(join(tmpdir(), 'src-app-'));
    const target = mkdtempSync(join(tmpdir(), 'dst-app-'));

    writeFileSync(join(source, 'package.json'), '{"name":"bermooda"}');
    mkdirSync(join(source, 'app', 'core'), { recursive: true });
    writeFileSync(join(source, 'app', 'core', 'x.js'), 'ok');
    mkdirSync(join(source, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(source, 'node_modules', 'pkg', 'index.js'), 'skip');
    writeFileSync(join(source, '.env'), 'SECRET=1\n');
    mkdirSync(join(source, 'prisma'), { recursive: true });
    writeFileSync(join(source, 'prisma', 'dev.db'), 'sqlite');

    const result = copyLocalApp(source, target);
    expect(result.method).toBe('local');
    expect(result.sourceRef).toContain(source);
    expect(readFileSync(join(target, 'app', 'core', 'x.js'), 'utf8')).toBe(
      'ok'
    );
    expect(existsSync(join(target, 'node_modules'))).toBe(false);
    expect(existsSync(join(target, '.env'))).toBe(false);
    expect(existsSync(join(target, 'prisma', 'dev.db'))).toBe(false);
  });

  it('exits when source is missing', () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const target = mkdtempSync(join(tmpdir(), 'dst-miss-'));
    expect(() =>
      copyLocalApp(join(tmpdir(), 'no-such-app-dir'), target)
    ).toThrow(/exit:1/);
  });

  it('exits when package.json is missing', () => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const source = mkdtempSync(join(tmpdir(), 'src-bad-'));
    const target = mkdtempSync(join(tmpdir(), 'dst-bad-'));
    expect(() => copyLocalApp(source, target)).toThrow(/exit:1/);
  });
});

describe('downloadApp default source', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses bermooda@latest from npm when no --ref is given', async () => {
    const npmRoot = mkdtempSync(join(tmpdir(), 'npm-app-'));
    const pkgDir = join(npmRoot, 'package');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'bermooda', version: '0.1.0' })
    );
    mkdirSync(join(pkgDir, 'app', 'core'), { recursive: true });
    writeFileSync(join(pkgDir, 'app', 'core', 'x.js'), 'from-npm');

    const npmMod = await import('../src/lib/npm-pack.js');
    const spy = vi.spyOn(npmMod, 'downloadNpmPackage').mockResolvedValue({
      sourceDir: pkgDir,
      cleanup: npmRoot,
      packageJson: { name: 'bermooda', version: '0.1.0' },
    });

    const target = mkdtempSync(join(tmpdir(), 'dst-npm-'));
    // downloadAppFromNpm cpSync into target; start empty
    rmSync(target, { recursive: true, force: true });

    const result = await downloadApp({ targetDir: target });
    expect(spy).toHaveBeenCalledWith('bermooda@latest');
    expect(result).toEqual({
      sourceRef: 'bermooda@0.1.0',
      method: 'npm',
    });
    expect(readFileSync(join(target, 'app', 'core', 'x.js'), 'utf8')).toBe(
      'from-npm'
    );
    expect(existsSync(npmRoot)).toBe(false);
  });
});
