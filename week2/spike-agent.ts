/**
 * Spike stage 2: the full lesson loop in miniature.
 *
 * An agent with:
 *   - whoIs        (hand-written fake-HR tool — the "different system")
 *   - three GitHub MCP tools (filtered from ~44 — don't hand a new hire every key)
 *
 * Question: Priya asks for read access to chug2k/churn-dashboard.
 * The agent must join fake HR + the real repo's README and recommend.
 *
 *   npx tsx spike-agent.ts
 */
import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import { execSync } from 'node:child_process';
import { z } from 'zod';

// Anduin LiteLLM proxy — OpenAI-compatible endpoint
const litellm = createOpenAI({
  baseURL: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
});
const MODEL = process.env.LITELLM_MODEL ?? 'anthropic.claude-sonnet-5-global';

// --- fake HR: a different system, on purpose -------------------------------
const ORG: Record<string, { team: string; role: string; type: string }> = {
  priya: { team: 'data', role: 'analytics engineer', type: 'employee' },
  jake: { team: 'marketing', role: 'campaign contractor', type: 'contractor' },
};

const whoIs = createTool({
  id: 'who_is',
  description: 'Look up a person in the company HR system: team, role, employment type.',
  inputSchema: z.object({ person: z.string().describe('first name, lowercase') }),
  outputSchema: z.object({ found: z.boolean(), team: z.string().optional(), role: z.string().optional(), type: z.string().optional() }),
  execute: async ({ person }) => {
    const rec = ORG[person.toLowerCase()];
    return rec ? { found: true, ...rec } : { found: false };
  },
});

// --- real GitHub, via MCP ---------------------------------------------------
const token = process.env.GITHUB_TOKEN ?? execSync('gh auth token').toString().trim();
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
  const all = await mcp.listTools();
  const KEEP = ['github_get_file_contents', 'github_search_repositories', 'github_get_me'];
  const githubTools = Object.fromEntries(Object.entries(all).filter(([k]) => KEEP.includes(k)));
  console.log(`GitHub MCP: ${Object.keys(all).length} tools available, passing ${Object.keys(githubTools).length} to the agent\n`);

  const agent = new Agent({
    id: 'access-agent',
    name: 'Access Agent',
    instructions: `You review GitHub repo access requests for the company.
Policy:
- Team members get read access to repos their team maintains: recommend GRANT.
- Write access always needs the maintaining team's sign-off: recommend ROUTE TO OWNER.
- Admin is never automated: recommend ESCALATE.
- Contractors never get access to repos containing customer data without sign-off.
To decide, look the requester up in HR (who_is) and read the repo's README to
learn what it is and who maintains it. State your reasoning, then a one-word
verdict: GRANT, ROUTE, or ESCALATE.`,
    model: litellm.chat(MODEL),
    tools: { who_is: whoIs, ...githubTools },
  });

  const question = process.argv[2]
    ?? 'Priya is asking for read access to the repo chug2k/churn-dashboard. What do you recommend?';
  const res = await agent.generate(question);
  console.log('--- agent answer ---\n' + res.text);
  await mcp.disconnect();
}

main().catch((e) => { console.error('❌ FAIL:', String(e).slice(0, 500)); process.exit(1); });
