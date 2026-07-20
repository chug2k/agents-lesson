// Tool definitions (what the agent sees) + implementations (what the
// agent doesn't see — wired to the fake data layer).
//
// The mock lives behind the tool boundary, not in front of it. Swap
// the body of `get_account_detail` for a Salesforce call later and
// the agent code doesn't change.

import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import { accounts, getAccount, type Account } from "../data/accounts.js";
import { signalsForAccount } from "../data/people-signals.js";
import { newsForAccount } from "../data/news.js";
import { clock } from "./clock.js";
import { memory } from "./state.js";

// ── Tool schemas — what the model sees ───────────────────────────

export const toolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_accounts",
      description:
        "Return all 20 accounts you own as a compact list. Each entry has id, name, segment (smb/mid/enterprise), renewal date, days until renewal, current health score (0-100), and how long it's been since you last touched it. Start here on a daily sweep.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_detail",
      description:
        "Full record for one account: contacts, contract value, last touchpoints, freeform notes (the kind of thing a great AM remembers — Q3 launches, family stuff, prior pain points). Call this before any non-trivial decision about an account.",
      parameters: {
        type: "object",
        properties: { account_id: { type: "string" } },
        required: ["account_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_news",
      description:
        "Search recent (last 30 sim-days) news for a company. Returns headlines + sentiment. Use when an account is approaching renewal, when health has shifted, or when a person-signal hints at something happening at the company.",
      parameters: {
        type: "object",
        properties: { company: { type: "string" } },
        required: ["company"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_people_signals",
      description:
        "Recent (last 60 sim-days) job changes, promotions, departures, and notable LinkedIn posts for known contacts at an account. A champion changing jobs is the single highest-signal event in your job — always check before a renewal action.",
      parameters: {
        type: "object",
        properties: { account_id: { type: "string" } },
        required: ["account_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_memory",
      description:
        "Your own notes and history for an account: prior observations you've made, last nudge date, total nudges sent. Use this to avoid repeating yourself, and to remember things you noticed last sweep.",
      parameters: {
        type: "object",
        properties: { account_id: { type: "string" } },
        required: ["account_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_renewal_email",
      description:
        "Draft (DO NOT SEND) a renewal email to the primary contact. Returns the draft for human review. Use only when an account is 30-90 days from renewal and you've consulted the renewal-email skill.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          tone: { type: "string", enum: ["warm", "neutral", "precise"] },
          key_points: {
            type: "array",
            items: { type: "string" },
            description: "3-5 bullet points the draft should hit. Be specific.",
          },
        },
        required: ["account_id", "tone", "key_points"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_for_human",
      description:
        "Escalate to the human AM with a one-line reason and urgency. Use when judgment exceeds your authority (discount > 10%, churn risk, champion change, multi-year deals, competitor mentioned). Over-escalating is fine; under-escalating loses trust.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          reason: { type: "string" },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["account_id", "reason", "urgency"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "note_observation",
      description:
        "Add a freeform observation to your memory for an account. Use for things you want future-you to remember on the next sweep ('Cate mentioned a Q3 launch'). Cheap, useful, no human ever sees it directly.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          text: { type: "string" },
        },
        required: ["account_id", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_no_action",
      description:
        "Explicitly record that you looked at this account today and chose to do nothing. Required for the log to be honest — silence isn't an action. Include a one-line reason ('healthy, 87d out, last touched Tuesday').",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["account_id", "reason"],
        additionalProperties: false,
      },
    },
  },
];

// ── Implementations — what the agent doesn't see ─────────────────

export const toolImpls: Record<string, (args: any) => Promise<unknown>> = {
  list_accounts: async () =>
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      segment: a.segment,
      renewal: a.renewal,
      daysToRenewal: clock.daysUntil(a.renewal),
      health: a.health,
      daysSinceLastContact: clock.daysSince(a.lastContact),
    })),

  get_account_detail: async ({ account_id }: { account_id: string }) => {
    const a = getAccount(account_id);
    if (!a) return { error: `unknown account_id: ${account_id}` };
    return {
      ...a,
      daysToRenewal: clock.daysUntil(a.renewal),
      daysSinceLastContact: clock.daysSince(a.lastContact),
      asOf: clock.iso(),
    };
  },

  search_news: async ({ company }: { company: string }) => {
    const needle = company.toLowerCase();
    const acct = accounts.find(
      (a) => a.name.toLowerCase() === needle || a.id.toLowerCase() === needle,
    );
    if (!acct) return { results: [], note: "no recent news found" };
    const since = clock.isoDaysAgo(30);
    return { company: acct.name, since, results: newsForAccount(acct.id, since) };
  },

  get_people_signals: async ({ account_id }: { account_id: string }) => {
    const since = clock.isoDaysAgo(60);
    return { since, results: signalsForAccount(account_id, since) };
  },

  get_account_memory: async ({ account_id }: { account_id: string }) => {
    const m = memory.forAccount(account_id);
    return {
      account_id,
      lastSweptDay: m.lastSweptDay ?? null,
      lastNudgeDay: m.lastNudgeDay ?? null,
      nudgeCount: m.nudgeCount,
      observations: m.observations,
    };
  },

  draft_renewal_email: async ({
    account_id,
    tone,
    key_points,
  }: {
    account_id: string;
    tone: string;
    key_points: string[];
  }) => {
    const a = getAccount(account_id);
    if (!a) return { error: `unknown account_id: ${account_id}` };
    const body = synthDraft(a, tone, key_points);
    memory.addDraft({ accountId: account_id, tone, body, createdDay: clock.day() });
    memory.recordNudge(account_id, clock.day());
    return { status: "drafted", account_id, tone, preview: body };
  },

  flag_for_human: async ({
    account_id,
    reason,
    urgency,
  }: {
    account_id: string;
    reason: string;
    urgency: string;
  }) => {
    memory.addEscalation({ accountId: account_id, reason, urgency, createdDay: clock.day() });
    return { status: "escalated", account_id, urgency, queued: true };
  },

  note_observation: async ({ account_id, text }: { account_id: string; text: string }) => {
    memory.noteObservation(account_id, text);
    return { saved: true, account_id };
  },

  mark_no_action: async ({ account_id, reason }: { account_id: string; reason: string }) => {
    memory.recordSweep(account_id, clock.day());
    return { logged: true, account_id, reason };
  },
};

// Tiny templater so the "draft" actually contains content. Real
// version of this is the model writing prose; here we just stitch
// the AM's key points so the reader can see what shipped.
function synthDraft(a: Account, tone: string, points: string[]): string {
  const greet = tone === "warm" ? `Hi ${a.primaryContact.name.split(" ")[0]},` : `Hi ${a.primaryContact.name},`;
  const lines = points.map((p) => `  • ${p}`).join("\n");
  return `${greet}\n\n${lines}\n\n— [your name]`;
}
