import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyLocalApp } from '../src/lib/download.js';

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
