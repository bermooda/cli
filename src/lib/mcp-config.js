import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOOTSTRAP_API_KEY_FILE,
  DEFAULT_BERMOODA_URL,
  EXIT,
} from './constants.js';
import { error } from './logger.js';
import { loadShopEnv, readTextIfExists } from './process.js';

/** @typedef {{ command: string, args: string[], env: Record<string, string> }} McpServerEntry */

/** Cursor MCP config directory under shop root. */
export const MCP_CONFIG_DIR = '.cursor';

/** Cursor MCP config file path (relative to shop root). */
export const MCP_CONFIG_FILE = `${MCP_CONFIG_DIR}/mcp.json`;

/** MCP server name written into mcp.json. */
export const MCP_SERVER_NAME = 'bermooda';

/**
 * Resolve shop URL for MCP: CLI flag > shop .env > default.
 * @param {string} shopRoot
 * @param {string | undefined} cliUrl
 * @returns {string}
 */
export function resolveMcpUrl(shopRoot, cliUrl) {
  if (cliUrl) return cliUrl;
  const env = loadShopEnv(shopRoot);
  if (env.BERMOODA_URL) return env.BERMOODA_URL;
  return DEFAULT_BERMOODA_URL;
}

/**
 * Resolve admin API key: CLI flag > shop .env > bootstrap file.
 * @param {string} shopRoot
 * @param {string | undefined} cliKey
 * @returns {string | null}
 */
export function resolveMcpApiKey(shopRoot, cliKey) {
  if (cliKey) return cliKey;
  const env = loadShopEnv(shopRoot);
  if (env.BERMOODA_API_KEY) return env.BERMOODA_API_KEY;
  const raw = readTextIfExists(join(shopRoot, BOOTSTRAP_API_KEY_FILE));
  if (raw) {
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Build the bermooda MCP server entry for Cursor / Claude Desktop.
 * @param {string} url
 * @param {string} apiKey
 * @returns {McpServerEntry}
 */
export function buildMcpServerEntry(url, apiKey) {
  return {
    command: 'npx',
    args: ['-y', 'bermooda-mcp'],
    env: {
      BERMOODA_URL: url,
      BERMOODA_API_KEY: apiKey,
    },
  };
}

/**
 * Merge bermooda server into existing MCP config JSON.
 * @param {Record<string, unknown>} existing
 * @param {McpServerEntry} bermoodaEntry
 * @returns {Record<string, unknown>}
 */
export function mergeMcpConfig(existing, bermoodaEntry) {
  const mcpServers =
    existing.mcpServers &&
    typeof existing.mcpServers === 'object' &&
    !Array.isArray(existing.mcpServers)
      ? /** @type {Record<string, unknown>} */ (existing.mcpServers)
      : {};

  return {
    ...existing,
    mcpServers: {
      ...mcpServers,
      [MCP_SERVER_NAME]: bermoodaEntry,
    },
  };
}

/**
 * Read existing `.cursor/mcp.json` or return empty object.
 * @param {string} configPath
 * @param {{ force?: boolean }} [opts]
 * @returns {Record<string, unknown>}
 */
export function readExistingMcpConfig(configPath, opts = {}) {
  if (!existsSync(configPath)) return {};
  const raw = readFileSync(configPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return /** @type {Record<string, unknown>} */ (parsed);
    }
    if (!opts.force) {
      error(
        `${MCP_CONFIG_FILE} is not a JSON object. Pass --force to replace it.`
      );
      process.exit(EXIT.USER);
    }
    return {};
  } catch {
    if (!opts.force) {
      error(
        `${MCP_CONFIG_FILE} contains invalid JSON. Pass --force to replace it.`
      );
      process.exit(EXIT.USER);
    }
    return {};
  }
}

/**
 * Write `.cursor/mcp.json` with bermooda server config (merge when possible).
 * @param {string} shopRoot
 * @param {string} url
 * @param {string} apiKey
 * @param {{ force?: boolean }} [opts]
 * @returns {string} absolute path to written config
 */
export function writeMcpConfig(shopRoot, url, apiKey, opts = {}) {
  const configPath = join(shopRoot, MCP_CONFIG_FILE);
  const cursorDir = join(shopRoot, MCP_CONFIG_DIR);
  mkdirSync(cursorDir, { recursive: true });

  const existing = readExistingMcpConfig(configPath, opts);
  const bermoodaEntry = buildMcpServerEntry(url, apiKey);
  const merged = mergeMcpConfig(existing, bermoodaEntry);

  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return configPath;
}
