import { describe, expect, it } from 'vitest';

import {
  confirmOrDefault,
  passwordOrFail,
  selectOrDefault,
  textOrDefault,
} from '../src/lib/prompts.js';

describe('prompts non-interactive paths', () => {
  const yes = { yes: true, interactive: false };
  const noTty = { yes: false, interactive: false };

  it('textOrDefault returns default when yes or non-interactive', async () => {
    expect(await textOrDefault(yes, 'Name', 'default-name')).toBe(
      'default-name'
    );
    expect(await textOrDefault(noTty, 'Name', 'fallback')).toBe('fallback');
  });

  it('selectOrDefault returns initial or first option', async () => {
    const options = [
      { value: 'sqlite', label: 'SQLite' },
      { value: 'postgresql', label: 'Postgres' },
    ];
    expect(await selectOrDefault(yes, 'DB', options, 'postgresql')).toBe(
      'postgresql'
    );
    expect(await selectOrDefault(noTty, 'DB', options)).toBe('sqlite');
  });

  it('confirmOrDefault returns the default without prompting', async () => {
    expect(await confirmOrDefault(yes, 'Continue?', false)).toBe(false);
    expect(await confirmOrDefault(noTty, 'Continue?', true)).toBe(true);
  });

  it('passwordOrFail throws when password cannot be prompted', async () => {
    await expect(passwordOrFail(yes, 'Admin password')).rejects.toThrow(
      /password required/
    );
    await expect(passwordOrFail(noTty, 'Admin password')).rejects.toThrow(
      /--admin-password/
    );
  });
});
