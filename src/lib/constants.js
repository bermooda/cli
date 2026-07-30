/** App source repository (shop codebase). */
export const APP_REPO = 'https://github.com/bermooda/bermooda.git';

/** GitHub owner/repo for the app. */
export const APP_REPO_SLUG = 'bermooda/bermooda';

/** Published npm package for the shop app (default install source). */
export const APP_NPM_PACKAGE = 'bermooda';

/** Default plugin/theme registry index URL. */
export const DEFAULT_REGISTRY_URL =
  process.env.BERMOODA_REGISTRY_URL ??
  'https://raw.githubusercontent.com/bermooda/registry/main/index.json';

/** Minimum Node major.minor required (match app engines). */
export const MIN_NODE = '22.22.0';

/** Directory under shop root for CLI metadata and backups. */
export const BERMOODA_DIR = '.bermooda';

/** Marker file written after install. */
export const PROJECT_JSON = `${BERMOODA_DIR}/project.json`;

/** One-line bootstrap API key written by shop seed (when present). */
export const BOOTSTRAP_API_KEY_FILE = `${BERMOODA_DIR}/bootstrap-api-key`;

/** Default shop URL when not configured elsewhere. */
export const DEFAULT_BERMOODA_URL = 'http://localhost:3000';

/** Safe plugin/theme id pattern. */
export const SAFE_ID_RE = /^[a-z0-9-]+$/;

/**
 * Default extensions cloned into the shop by `bermooda dev-setup`.
 * Destinations use `bermooda.slug` under `app/themes/` or `app/plugins/`.
 * @type {ReadonlyArray<{
 *   kind: 'theme' | 'plugin',
 *   slug: string,
 *   repo: string,
 *   packageId: string,
 * }>}
 */
export const CONTRIBUTOR_EXTENSIONS = Object.freeze([
  {
    kind: 'theme',
    slug: 'default',
    repo: 'https://github.com/bermooda/theme-default.git',
    packageId: '@bermooda/theme-default',
  },
  {
    kind: 'plugin',
    slug: 'meilisearch',
    repo: 'https://github.com/bermooda/plugin-meilisearch.git',
    packageId: '@bermooda/plugin-meilisearch',
  },
  {
    kind: 'plugin',
    slug: 'resend',
    repo: 'https://github.com/bermooda/plugin-resend.git',
    packageId: '@bermooda/plugin-resend',
  },
]);

/** Exit codes (see DESIGN.md). */
export const EXIT = {
  OK: 0,
  USER: 1,
  NETWORK: 2,
  DEPS: 3,
  DB: 4,
  SIGINT: 130,
};
