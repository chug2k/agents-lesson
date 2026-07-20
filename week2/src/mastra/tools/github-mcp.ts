import { MCPClient } from '@mastra/mcp';

/**
 * GitHub's remote MCP server, authed with a token over a Bearer header.
 * (The server doesn't support MCP dynamic client registration, so OAuth
 * self-registration isn't an option — a token is the low-friction path.)
 */
const token = process.env.GITHUB_TOKEN;

export const githubMcp = new MCPClient({
  servers: {
    github: {
      url: new URL('https://api.githubcopilot.com/mcp/'),
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    },
  },
  timeout: 60000,
});

// The server exposes ~44 tools; hand the agent only what the job needs.
const KEEP = ['github_get_file_contents', 'github_search_repositories', 'github_get_me'];

export async function getGithubTools() {
  if (!token) {
    console.warn('GITHUB_TOKEN not set — access agent will run without GitHub tools.');
    return {};
  }
  try {
    const all = await githubMcp.listTools();
    return Object.fromEntries(Object.entries(all).filter(([k]) => KEEP.includes(k)));
  } catch (e) {
    console.warn('GitHub MCP unavailable:', String(e).slice(0, 200));
    return {};
  }
}
