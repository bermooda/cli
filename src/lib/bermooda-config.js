import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Escape a string for use inside a single-quoted JS string literal.
 * @param {string} value
 * @returns {string}
 */
function escapeSingleQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Build bermooda.config.js source from install/dev-setup answers.
 *
 * @param {{ baseUrl?: string | null, fromNoReply: string }} opts
 * @returns {string}
 */
export function buildBermoodaConfigSource(opts) {
  const fromNoReply = String(opts.fromNoReply ?? '').trim();
  if (!fromNoReply) {
    throw new Error('fromNoReply is required to write bermooda.config.js');
  }

  const baseUrl =
    typeof opts.baseUrl === 'string' && opts.baseUrl.trim() !== ''
      ? opts.baseUrl.trim().replace(/\/+$/, '')
      : null;

  const lines = [
    'const config = {',
    '  // Public site URL. Required in production. Optional in development —',
    '  // when omitted, the app defaults to http://localhost:${PORT}.',
  ];

  if (baseUrl) {
    lines.push(`  baseUrl: '${escapeSingleQuoted(baseUrl)}',`);
  } else {
    lines.push(`  // baseUrl: 'https://shop.example.com',`);
  }

  lines.push(
    '  email: {',
    `    fromNoReply: '${escapeSingleQuoted(fromNoReply)}',`,
    '  },',
    '};',
    '',
    'export default config;',
    ''
  );

  return lines.join('\n');
}

/**
 * Write bermooda.config.js into a shop root.
 *
 * @param {string} shopRoot
 * @param {{ baseUrl?: string | null, fromNoReply: string }} opts
 * @returns {string} Absolute path written
 */
export function writeBermoodaConfig(shopRoot, opts) {
  const path = join(shopRoot, 'bermooda.config.js');
  writeFileSync(path, buildBermoodaConfigSource(opts), 'utf8');
  return path;
}
