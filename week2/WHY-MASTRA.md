# Why Mastra?

Fair question — the week-1 spike scripts worked fine without it. An agent is
just a loop: send messages, execute tool calls, repeat. You saw that.

## Why any framework at all

The vanilla loop is easy to write and easy to write *wrong* — history
management, tool-result plumbing, stopping conditions, retries. A framework
gives everyone (especially non-engineers) a safer, structured space: a named
place for agents, tools, and instructions; Zod-validated tool inputs; and
Studio to watch the agent think instead of reading console logs. The overhead
is real — more concepts, more code — but the structure forces some thought
before shipping.

## The alternatives we didn't pick

- **Vercel AI SDK** — excellent for adding AI features *inside* a web app
  (streaming, React hooks), and Mastra actually uses it under the hood for
  model streaming. But it's a UI/streaming toolkit, not an agent workbench:
  no memory, no evals, no Studio equivalent.
- **LangChain / LangGraph** — the most established and probably the most
  proven in production. Also the most painful: Python-first heritage, a heavy
  graph abstraction, and lots of API churn. It feels very "1.0."
- **OpenAI Agents SDK** — the simplest loop, but built around OpenAI. We
  route models through a LiteLLM proxy, so provider lock-in is a non-starter.
- **CrewAI / Pydantic AI / smolagents** — Python. Our audience lives in
  TypeScript.

## The choice is cheap to reverse

An agent is mostly instructions (a prompt), tool definitions, and a loop.
Our tools arrive over MCP, which is framework-agnostic by design — the GitHub
tools would plug into any of the frameworks above. Switching later is a port,
not a rewrite. So: pick one, build, and re-evaluate when something better
comes along.

## Mastra's tenets

1. **TypeScript-native, typed end-to-end.** Zod schemas on every tool input
   and output — your editor autocompletes, refactors don't silently break
   agents.
2. **One opinionated API.** No choosing between four memory abstractions.
3. **Agents vs. workflows is an explicit distinction.** Agents when the model
   should decide what to do next; workflows when the steps are fixed and must
   be predictable.
4. **Batteries included.** Memory, evals (scorers), tracing, and MCP support
   ship in the box instead of as bolt-ons.
5. **Model-agnostic.** The provider is a config line, not an architecture —
   which is how our LiteLLM proxy slots in.
6. **Local-first.** Studio runs on your machine so you inspect the agent's
   decisions before anything deploys.
