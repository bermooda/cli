import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXIT } from './constants.js';
import { error, success } from './logger.js';

/**
 * @returns {string}
 */
export function randomSecret() {
  return randomBytes(32).toString('hex');
}

/**
 * Parse .env.example-style content into ordered key comments + values.
 * @param {string} text
 * @returns {{ key: string | null, line: string, value?: string }[]}
 */
export function parseEnvExample(text) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return { key: null, line };
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) return { key: null, line };
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return { key, line, value };
  });
}

/**
 * Quote a value for .env if needed.
 * @param {string} value
 */
export function quoteEnvValue(value) {
  if (/[\s#"']/.test(value) || value === '') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Build .env content from example + overrides.
 * @param {string} exampleText
 * @param {Record<string, string>} overrides
 * @returns {string}
 */
export function buildEnvFile(exampleText, overrides) {
  const lines = parseEnvExample(exampleText);
  const seen = new Set();
  const out = [];

  for (const entry of lines) {
    if (entry.key == null) {
      out.push(entry.line);
      continue;
    }
    seen.add(entry.key);
    const value =
      overrides[entry.key] !== undefined
        ? overrides[entry.key]
        : (entry.value ?? '');
    out.push(`${entry.key}=${quoteEnvValue(value)}`);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!seen.has(key)) {
      out.push(`${key}=${quoteEnvValue(value)}`);
    }
  }

  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * Write .env atomically.
 * @param {string} shopRoot
 * @param {string} content
 * @param {{ force?: boolean }} [opts]
 */
export function writeEnvFile(shopRoot, content, opts = {}) {
  const path = join(shopRoot, '.env');
  if (existsSync(path) && !opts.force) {
    error(
      '.env already exists. Pass --force-env to overwrite, or remove it manually.'
    );
    process.exit(EXIT.USER);
  }
  const tmp = join(shopRoot, `.env.${process.pid}.tmp`);
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
  success('Wrote .env');
}

/**
 * Read shop .env.example or return a minimal template.
 * @param {string} shopRoot
 */
export function readEnvExample(shopRoot) {
  const path = join(shopRoot, '.env.example');
  if (existsSync(path)) {
    return readFileSync(path, 'utf8');
  }
  return `DATABASE_URL="file:./prisma/dev.db"
QUEUE_DATABASE_PATH="./prisma/queue.db"
BETTER_AUTH_SECRET=your-secret-key
HEALTH_TOKEN=your-health-token
`;
}

/**
 * Defaults for install mode.
 * @param {'local' | 'server'} mode
 * @param {{ databaseUrl?: string, databaseProvider?: string }} opts
 */
export function defaultEnvOverrides(mode, opts = {}) {
  /** @type {Record<string, string>} */
  const overrides = {
    BETTER_AUTH_SECRET: randomSecret(),
    HEALTH_TOKEN: randomSecret(),
    QUEUE_DATABASE_PATH: './prisma/queue.db',
  };

  if (mode === 'local') {
    overrides.DATABASE_URL = opts.databaseUrl ?? 'file:./prisma/dev.db';
    if (opts.databaseProvider) {
      overrides.DATABASE_PROVIDER = opts.databaseProvider;
    }
  } else {
    if (opts.databaseUrl) {
      overrides.DATABASE_URL = opts.databaseUrl;
    }
    overrides.DATABASE_PROVIDER = opts.databaseProvider ?? 'postgresql';
  }

  return overrides;
}
