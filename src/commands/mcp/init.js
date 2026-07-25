import { EXIT } from '../../lib/constants.js';
import { error, success } from '../../lib/logger.js';
import {
  MCP_SERVER_NAME,
  resolveMcpApiKey,
  resolveMcpUrl,
  writeMcpConfig,
} from '../../lib/mcp-config.js';
import { assertInShop } from '../../lib/project.js';

/**
 * Write Cursor MCP config for the current shop.
 * @param {Record<string, any>} args
 */
export async function mcpInit(args = {}) {
  const shopRoot = assertInShop(args.cwd ?? process.cwd());

  const url = resolveMcpUrl(shopRoot, args.url);
  const apiKey = resolveMcpApiKey(shopRoot, args.key);

  if (!apiKey) {
    error(
      'No API key found for MCP.\n' +
        'Re-run shop seed/bootstrap, pass --key, or create a key via Admin UI / POST /api/admin/v1/setup/api-key.'
    );
    process.exit(EXIT.USER);
  }

  const configPath = writeMcpConfig(shopRoot, url, apiKey, {
    force: Boolean(args.force),
  });

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          url,
          keyPresent: true,
          path: configPath,
        },
        null,
        2
      )
    );
    return;
  }

  success(`Wrote MCP config to ${configPath}`);
  console.log(
    `\nClaude Desktop: add the same "${MCP_SERVER_NAME}" server block to claude_desktop_config.json (see Claude MCP docs).`
  );
}
