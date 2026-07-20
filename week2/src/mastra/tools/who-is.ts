import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Fake HR: a different system from GitHub, on purpose — the agent has to
// join data across the two to make an access decision.
const ORG: Record<string, { team: string; role: string; type: string }> = {
  priya: { team: 'data', role: 'analytics engineer', type: 'employee' },
  jake: { team: 'marketing', role: 'campaign contractor', type: 'contractor' },
};

export const whoIs = createTool({
  id: 'who_is',
  description: 'Look up a person in the company HR system: team, role, employment type.',
  inputSchema: z.object({ person: z.string().describe('first name, lowercase') }),
  outputSchema: z.object({
    found: z.boolean(),
    team: z.string().optional(),
    role: z.string().optional(),
    type: z.string().optional(),
  }),
  execute: async ({ person }) => {
    const rec = ORG[person.toLowerCase()];
    return rec ? { found: true, ...rec } : { found: false };
  },
});
