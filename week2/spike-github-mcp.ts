/**
 * Spike: Mastra MCPClient → GitHub remote MCP server, authed with the
 * token from `gh auth login` (friendly OAuth device flow, no PAT page).
 *
 *   npx tsx spike-github-mcp.ts
 *
 * Note: GitHub's remote MCP server does NOT support MCP dynamic client
 * registration, so Mastra's MCPOAuthClientProvider can't self-register.
 * The gh CLI token over a Bearer header is the low-friction path.
 */
import { MCPClient } from '@mastra/mcp';
import { execSync } from 'node:child_process';

const token = process.env.GITHUB_TOKEN ?? execSync('gh auth token').toString().trim();
if (!token) {
  console.error('No GitHub token. Run `gh auth login` first.');
  process.exit(1);
}

const mcp = new MCPClient({
  servers: {
    github: {
      url: new URL('https://api.githubcopilot.com/mcp/'),
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    },
  },
  timeout: 60000,
});

async function main() {
  const tools = await mcp.listTools();
  const names = Object.keys(tools);
  if (names.length === 0) throw new Error('Connected but got zero tools');
  console.log(`✅ ${names.length} tools from GitHub MCP. Sample:`);
  console.log(names.slice(0, 15).map((n) => '  · ' + n).join('\n'));
  await mcp.disconnect();
  console.log('\nSpike stage 1: PASS');
}

main().catch((e) => {
  console.error('\n❌ Spike FAIL:', String(e).slice(0, 400));
  process.exit(1);
});
