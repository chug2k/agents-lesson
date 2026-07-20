# AM Agent Sim

A simulated Account Manager agent for the [agents lesson](../index.html). It owns a fake book of 20 accounts, sweeps them on a fake clock, and decides — using a real LLM with native tool use — what to do, draft, escalate, or ignore each day.

The point isn't to ship an AM agent. The point is to **edit the system prompt or a skill, hit Run, and watch the agent's behavior change.** That's the lesson — the prompt *is* the employee — in your hands.

## What's mocked vs. what's real

**Real:** The agent loop. Tool use. The Claude (or any model) calls. The system prompt + skills design. The Express server. The SSE event stream. The permission ladder pattern. The architecture.

**Mocked:** The CRM (`data/accounts.ts`). The news feed (`data/news.ts`). The people-intelligence feed (`data/people-signals.ts`). The clock (`lib/clock.ts`). All sit behind the tool boundary — swap any one for a real API and the agent code doesn't change.

## Setup

```bash
cd am-agent-sim
npm install
cp .env.example .env   # edit with your LLM credentials
npm run dev            # serves dashboard at http://localhost:3000
```

## LLM connection

The sim talks to any OpenAI-compatible endpoint via the standard OpenAI SDK. Three ways to wire it:

### A. A company LLM proxy (recommended for production-shaped builds)

Most companies running multiple agent teams stand up a proxy — Anduin runs LiteLLM internally, Vercel has the AI Gateway, others use LangChain/Helicone/their own. Set:

```
LLM_BASE_URL=https://your-proxy.example.com/v1
LLM_API_KEY=<key from the proxy>
LLM_MODEL=claude-sonnet-4-6
```

Why this is the right answer in real life: prompt caching, central key management, observability, rate limits, and provider portability all live at the proxy layer. The sim defaults to this shape because it's what scales.

### B. Vercel AI Gateway (fastest zero-infra path for a reader at home)

```
LLM_BASE_URL=https://ai-gateway.vercel.sh/v1
LLM_API_KEY=<your gateway key>
LLM_MODEL=anthropic/claude-sonnet-4-6
```

### C. Anthropic directly (simplest but no prompt caching)

```
LLM_BASE_URL=https://api.anthropic.com/v1/
LLM_API_KEY=<anthropic key>
LLM_MODEL=claude-sonnet-4-6
```

This works but the OpenAI-compatible endpoint at Anthropic doesn't support prompt caching, so you'll pay ~5x what a proxy with caching costs over a long sim session. Fine for a few sweeps; switch to A or B if you sit with the demo for hours.

## How it works

```
┌─ orchestrator (one Node process) ──────────────────────────┐
│                                                            │
│   FAKE CLOCK            CRON              HTTP SERVER      │
│   1 real sec     ───▶   each tick   ───▶  POST /sweep      │
│   = 1 sim day           checks day        POST /event      │
│                                                            │
│                            │                               │
│                            ▼                               │
│                    ┌──────────────────┐                    │
│                    │  AGENT LOOP      │                    │
│                    │  OpenAI SDK      │                    │
│                    │  → proxy → model │                    │
│                    │  tools: native   │                    │
│                    └────────┬─────────┘                    │
│                             │                              │
│            ┌────────────────┴─────────────────┐            │
│            ▼                                  ▼            │
│      tool calls                        decisions log       │
│      hit mocked APIs                   (decisions.jsonl)   │
│      (data/*.ts)                                           │
│                                                            │
└──── SSE stream ─────────────────────────────▶ dashboard ───┘
                                                http://:3000
```

Same three triggers as production — cron (fake clock tick), webhook (POST /api/event), manual (POST /api/sweep). All go through the same `lib/agent.ts`. Grep it; one body, three doorbells.

## The dashboard

- **World panel** — clock controls, account list with health + days-to-renewal, counts. The Reset button wipes `state.json` + `decisions.jsonl`.
- **Activity panel** — decision log, color-coded by action (gray = no_action, yellow = drafted, red = escalated). Click a decision to expand its tool calls. When the agent is running, the live stream shows tool calls as they fire.
- **You panel** — Run today's sweep, Advance 7 days, Fire event. Below that: tabs for the system prompt and each skill — edit in place, click save, rerun.

## The exercise

1. Run the default sweep. Watch the agent's first day.
2. Read `prompts/system.md`. Edit one of the `READER EDITS THIS` blocks (the operating principles or the voice rules). Save. Rerun. The drafts shift.
3. Open `skills/discount-ladder.md`. Lower the auto-approval cap from 5% to 3%. Save. Rerun. The agent escalates more.
4. Hit "Advance 7 days" a few times. Watch attention shift toward accounts whose renewals are approaching, and toward people-signals that just hit (champions changing jobs).
5. Open `skills/renewal-email.md`. Rewrite the tone matrix. Compare drafts before vs. after.

## What the agent has and doesn't have

Available tools (defined in `lib/tools.ts`):

| Tool | What it does |
|---|---|
| `list_accounts` | Compact roster + key fields |
| `get_account_detail` | Full record incl. freeform notes |
| `search_news` | Recent news for a company |
| `get_people_signals` | Job changes, promotions, departures |
| `get_account_memory` | The agent's own prior notes |
| `draft_renewal_email` | Drafts (never sends) |
| `flag_for_human` | Escalates to a human queue |
| `note_observation` | Writes to the agent's memory |
| `mark_no_action` | Explicit "nothing today" — required for an honest log |

Critically: there is no `send_email`, no `apply_discount`, no `revoke_access`. The permission ladder is expressed in the toolset, not in instructions. The agent literally cannot do what it doesn't have a tool for.

## Files of interest

- `lib/agent.ts` — the loop. ~50 lines that matter. Read this first.
- `lib/tools.ts` — tool schemas (what the model sees) + implementations (what it doesn't).
- `prompts/system.md` — the "onboarding doc."
- `skills/*.md` — the playbooks.
- `data/accounts.ts` — the fake CRM. Edit if you want different account scenarios.

## Costs

Each sweep makes ~15–25 LLM calls (1 per "thinking" iteration). With Sonnet 4.6 + a prompt-caching proxy, that's about **$0.03–$0.10 per sweep day**. Without caching (Path C above): ~5× that. The dashboard banner reminds you on first load. You're in control of the clock — pause when you walk away.

## Known scope

This is a teaching sim. Things deliberately omitted: durability beyond a JSON file, retries, structured outputs, evals, observability beyond the console + dashboard. Reach for production tooling when you actually ship one.
