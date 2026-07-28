import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Create a minimal bermooda shop tree for tests.
 * @param {{ name?: string, version?: string, withEnv?: boolean, withMeta?: object }} [opts]
 * @returns {string} shop root path
 */
export function createFixtureShop(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bermooda-shop-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: opts.name ?? 'bermooda',
        version: opts.version ?? '1.2.3',
        private: true,
      },
      null,
      2
    )
  );
  mkdirSync(join(root, 'app', 'core'), { recursive: true });
  mkdirSync(join(root, 'app', 'plugins'), { recursive: true });
  mkdirSync(join(root, 'app', 'themes', 'default'), { recursive: true });
  mkdirSync(join(root, 'prisma'), { recursive: true });
  writeFileSync(join(root, 'prisma', 'schema.prisma'), 'datasource db {}\n');
  writeFileSync(
    join(root, 'app', 'themes', 'default', 'manifest.js'),
    "export default { id: 'default', version: '1.0.0' };\n"
  );

  if (opts.withEnv) {
    writeFileSync(
      join(root, '.env'),
      'DATABASE_URL="file:./prisma/dev.db"\nBETTER_AUTH_SECRET=test-secret\n'
    );
  }

  if (opts.withMeta) {
    mkdirSync(join(root, '.bermooda'), { recursive: true });
    writeFileSync(
      join(root, '.bermooda', 'project.json'),
      `${JSON.stringify(opts.withMeta, null, 2)}\n`
    );
  }

  return root;
}

/**
 * Write a minimal plugin package directory.
 * @param {string} [id]
 * @returns {string} package root
 */
export function createFixturePlugin(id = 'demo-plugin') {
  const dir = mkdtempSync(join(tmpdir(), `plugin-${id}-`));
  writeFileSync(
    join(dir, 'manifest.js'),
    `export default { id: '${id}', version: '1.0.0' };\n`
  );
  writeFileSync(join(dir, 'index.server.js'), 'export default {};\n');
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: id, bermooda: { id, engine: '>=0.0.0' } }, null, 2)
  );
  return dir;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function exists(dir) {
  return existsSync(dir);
}
