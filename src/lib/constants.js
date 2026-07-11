/** App source repository (shop codebase). */
export const APP_REPO = 'https://github.com/bermooda/bermooda.git';

/** GitHub owner/repo for the app. */
export const APP_REPO_SLUG = 'bermooda/bermooda';

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

/** Safe plugin/theme id pattern. */
export const SAFE_ID_RE = /^[a-z0-9-]+$/;

/** Exit codes (see DESIGN.md). */
export const EXIT = {
  OK: 0,
  USER: 1,
  NETWORK: 2,
  DEPS: 3,
  DB: 4,
  SIGINT: 130,
};
