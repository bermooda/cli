import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Paths always shipped by npm, plus our package.json "files" whitelist.
 * Repo tooling (tests, workflows, agent docs, release config) must stay out.
 */
function isAllowedPackPath(path) {
  if (path === 'package.json' || path === 'README.md' || path === 'LICENSE') {
    return true;
  }
  return path === 'src' || path.startsWith('src/');
}

describe('npm package contents', () => {
  it('publishes only runtime sources and license/readme', () => {
    const raw = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const parsed = JSON.parse(raw);
    const files = parsed[0]?.files?.map((f) => f.path) ?? [];
    expect(files.length).toBeGreaterThan(0);

    const unexpected = files.filter((p) => !isAllowedPackPath(p));
    expect(unexpected).toEqual([]);

    expect(files).toContain('package.json');
    expect(files).toContain('README.md');
    expect(files).toContain('LICENSE');
    expect(files).toContain('src/cli.js');
    expect(files).toContain('src/data/builtin-registry.json');

    // Explicitly keep repo/meta out of the tarball.
    for (const banned of [
      'DESIGN.md',
      'AGENTS.md',
      'IMPLEMENTATION-PROMPT.md',
      'release-please-config.json',
      '.release-please-manifest.json',
      'CHANGELOG.md',
      'vitest.config.js',
      'package-lock.json',
      'test/helpers.js',
      '.github/workflows/publish.yml',
      '.cursor/rules/conventional-commits.mdc',
    ]) {
      expect(files).not.toContain(banned);
    }
  });
});
