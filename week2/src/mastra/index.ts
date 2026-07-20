import { Mastra } from '@mastra/core/mastra';
import { accessAgent } from './agents/access-agent';

export const mastra = new Mastra({
  agents: { accessAgent },
});
