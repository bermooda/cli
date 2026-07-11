import pc from 'picocolors';

let verbose = false;

/**
 * @param {boolean} enabled
 */
export function setVerbose(enabled) {
  verbose = Boolean(enabled);
}

export function isVerbose() {
  return verbose;
}

export function info(message) {
  console.log(pc.cyan('ℹ'), message);
}

export function success(message) {
  console.log(pc.green('✔'), message);
}

export function warn(message) {
  console.warn(pc.yellow('⚠'), message);
}

export function error(message) {
  console.error(pc.red('✖'), message);
}

export function debug(message) {
  if (verbose) {
    console.log(pc.dim(`… ${message}`));
  }
}

/**
 * @param {unknown} err
 * @param {string} [prefix]
 */
export function errorFrom(err, prefix) {
  const msg = err instanceof Error ? err.message : String(err);
  error(prefix ? `${prefix}: ${msg}` : msg);
  if (verbose && err instanceof Error && err.stack) {
    console.error(pc.dim(err.stack));
  }
}
