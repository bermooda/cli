import { describe, expect, it } from 'vitest';

import {
  APP_NPM_PACKAGE,
  APP_REPO,
  APP_REPO_SLUG,
  BOOTSTRAP_API_KEY_FILE,
  DEFAULT_BERMOODA_URL,
  EXIT,
  MIN_NODE,
  PROJECT_JSON,
  SAFE_ID_RE,
} from '../src/lib/constants.js';

describe('constants', () => {
  it('points at the public app repository', () => {
    expect(APP_REPO_SLUG).toBe('bermooda/bermooda');
    expect(APP_REPO).toContain('github.com/bermooda/bermooda');
    expect(APP_NPM_PACKAGE).toBe('bermooda');
  });

  it('requires Node matching the app engines floor', () => {
    expect(MIN_NODE).toBe('22.22.0');
  });

  it('defines documented exit codes', () => {
    expect(EXIT).toEqual({
      OK: 0,
      USER: 1,
      NETWORK: 2,
      DEPS: 3,
      DB: 4,
      SIGINT: 130,
    });
  });

  it('stores project marker under .bermooda', () => {
    expect(PROJECT_JSON).toBe('.bermooda/project.json');
    expect(BOOTSTRAP_API_KEY_FILE).toBe('.bermooda/bootstrap-api-key');
    expect(DEFAULT_BERMOODA_URL).toBe('http://localhost:3000');
  });

  it('SAFE_ID_RE matches design contract', () => {
    expect(SAFE_ID_RE.source).toBe('^[a-z0-9-]+$');
  });
});
