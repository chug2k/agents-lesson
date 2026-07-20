import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { whoIs } from '../tools/who-is';
import { getGithubTools } from '../tools/github-mcp';

// Anduin LiteLLM proxy — OpenAI-compatible endpoint
const litellm = createOpenAI({
  baseURL: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
});
const MODEL = process.env.LITELLM_MODEL ?? 'anthropic.claude-sonnet-5-global';

const githubTools = await getGithubTools();

export const accessAgent = new Agent({
  id: 'access-agent',
  name: 'Access Agent',
  description:
    'Reviews GitHub repo access requests by joining HR data with the repo itself.',
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
