import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { debug } from './logger.js';

/**
 * Load shop .env into a plain object (does not mutate process.env by default).
 * @param {string} shopRoot
 * @returns {Record<string, string>}
 */
export function loadShopEnv(shopRoot) {
  const envPath = join(shopRoot, '.env');
  const base = { ...process.env };
  if (!existsSync(envPath)) return /** @type {Record<string, string>} */ (base);

  const parsed = loadDotenv({ path: envPath, processEnv: {} }).parsed ?? {};
  return { ...base, ...parsed };
}

/**
 * Spawn a command with inherited stdio. Resolves with exit code.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean, silent?: boolean }} [opts]
 * @returns {Promise<number>}
 */
export function run(command, args, opts = {}) {
  debug(`$ ${command} ${args.join(' ')}`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ?? process.env,
      stdio: opts.silent ? 'ignore' : 'inherit',
      shell: opts.shell ?? false,
    });
    child.on('error', (err) => {
      // command not found
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
        resolvePromise(127);
        return;
      }
      reject(err);
    });
    child.on('close', (code, signal) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        resolvePromise(130);
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

/**
 * Spawn a command and capture stdout/stderr. Resolves with exit code + output.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean }} [opts]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runCapture(command, args, opts = {}) {
  debug(`$ ${command} ${args.join(' ')}`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: opts.shell ?? false,
    });
    /** @type {Buffer[]} */
    const outChunks = [];
    /** @type {Buffer[]} */
    const errChunks = [];
    child.stdout?.on('data', (chunk) => outChunks.push(chunk));
    child.stderr?.on('data', (chunk) => errChunks.push(chunk));
    child.on('error', (err) => {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
        resolvePromise({ code: 127, stdout: '', stderr: 'command not found' });
        return;
      }
      reject(err);
    });
    child.on('close', (code, signal) => {
      const stdout = Buffer.concat(outChunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        resolvePromise({ code: 130, stdout, stderr });
        return;
      }
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * @param {string} shopRoot
 * @param {string[]} npmArgs
 * @param {Record<string, string>} [env]
 */
export async function npm(shopRoot, npmArgs, env) {
  return run('npm', npmArgs, {
    cwd: shopRoot,
    env: env ?? loadShopEnv(shopRoot),
  });
}

/**
 * Detect how the CLI might have been installed globally.
 * @returns {'npm' | 'pnpm' | 'yarn'}
 */
export function detectPackageManager() {
  const ua = process.env.npm_config_user_agent ?? '';
  if (ua.includes('pnpm')) return 'pnpm';
  if (ua.includes('yarn')) return 'yarn';
  return 'npm';
}

/**
 * Read raw file if present.
 * @param {string} path
 */
export function readTextIfExists(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}
