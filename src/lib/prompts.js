import * as p from '@clack/prompts';

/**
 * @typedef {object} PromptContext
 * @property {boolean} yes
 * @property {boolean} interactive
 */

/**
 * @param {PromptContext} ctx
 * @param {string} message
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
export async function textOrDefault(ctx, message, defaultValue = '') {
  if (ctx.yes || !ctx.interactive) {
    return defaultValue;
  }
  const value = await p.text({
    message,
    initialValue: defaultValue,
    defaultValue,
  });
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(130);
  }
  return String(value ?? defaultValue);
}

/**
 * @param {PromptContext} ctx
 * @param {string} message
 * @param {{ value: string, label: string }[]} options
 * @param {string} [initialValue]
 * @returns {Promise<string>}
 */
export async function selectOrDefault(ctx, message, options, initialValue) {
  if (ctx.yes || !ctx.interactive) {
    return initialValue ?? options[0]?.value ?? '';
  }
  const value = await p.select({
    message,
    options: options.map((o) => ({ value: o.value, label: o.label })),
    initialValue: initialValue ?? options[0]?.value,
  });
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(130);
  }
  return String(value);
}

/**
 * @param {PromptContext} ctx
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function passwordOrFail(ctx, message) {
  if (ctx.yes || !ctx.interactive) {
    throw new Error(
      `${message}: password required (pass --admin-password or run interactively)`
    );
  }
  const value = await p.password({ message });
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(130);
  }
  return String(value);
}

/**
 * @param {PromptContext} ctx
 * @param {string} message
 * @param {boolean} [defaultValue]
 */
export async function confirmOrDefault(ctx, message, defaultValue = true) {
  if (ctx.yes || !ctx.interactive) {
    return defaultValue;
  }
  const value = await p.confirm({ message, initialValue: defaultValue });
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(130);
  }
  return Boolean(value);
}

export { p };
