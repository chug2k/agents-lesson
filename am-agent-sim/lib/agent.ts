// The agent loop. Loads the system prompt + skills, calls the LLM
// with tools, executes tool calls, loops until the model is done.
//
// Provider-agnostic: OpenAI SDK pointed at any OpenAI-compatible
// endpoint (Anduin's LiteLLM proxy, Vercel AI Gateway, the Anthropic
// compat endpoint, etc.). The model string travels through the call.

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions.js";
import { toolSchemas, toolImpls } from "./tools.js";
import { decisions } from "./state.js";
import { clock } from "./clock.js";
import { accounts } from "../data/accounts.js";

if (!process.env.LLM_API_KEY) {
  console.warn(
    "\n  ⚠  LLM_API_KEY is not set. Sweeps will fail with auth errors.\n" +
    "     Set it in .env — see README for proxy/provider options.\n",
  );
}

const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY ?? "missing",
  baseURL: process.env.LLM_BASE_URL ?? "https://api.anthropic.com/v1/",
});

const MODEL = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
const ROOT = path.join(process.cwd());

// ── Prompt loading ───────────────────────────────────────────────

function loadSystemPrompt(): string {
  const sys = fs.readFileSync(path.join(ROOT, "prompts/system.md"), "utf8");
  const skillsDir = path.join(ROOT, "skills");
  const skills = fs
    .readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const content = fs.readFileSync(path.join(skillsDir, f), "utf8");
      return `## Skill: ${f.replace(/\.md$/, "")}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  return `${sys}\n\n# Your playbooks\n\n${skills}`;
}

// ── Event stream — used by the SSE layer ─────────────────────────

export type AgentEvent =
  | { type: "sweep_started"; day: number; iso: string; trigger: WakeReason }
  | { type: "thinking"; iteration: number }
  | { type: "tool_call"; name: string; args: unknown; toolCallId: string }
  | { type: "tool_result"; name: string; result: unknown; toolCallId: string }
  | { type: "decision"; decision: import("./state.js").Decision }
  | { type: "sweep_finished"; day: number; summary: string; usage?: unknown }
  | { type: "error"; message: string };

type EventSink = (e: AgentEvent) => void;

// ── Wake reasons ─────────────────────────────────────────────────

export type WakeReason =
  | { kind: "daily_sweep" }
  | { kind: "manual_sweep" }
  | { kind: "event"; eventType: string; accountId?: string; detail?: string };

function buildUserMessage(wake: WakeReason): string {
  const today = `${clock.iso()} (sim day ${clock.day()})`;
  if (wake.kind === "event") {
    const parts = [`type=${wake.eventType}`];
    if (wake.accountId) parts.push(`account=${wake.accountId}`);
    if (wake.detail && wake.detail.trim()) parts.push(`detail=${wake.detail.trim()}`);
    return [
      `Today is ${today}.`,
      ``,
      `A reactive event just fired: ${parts.join(", ")}.`,
      ``,
      `Look only at this event and the account it concerns. Decide what (if anything) to do, act within your authority, and summarize.`,
    ].join("\n");
  }
  return [
    `Today is ${today}.`,
    ``,
    `Run today's sweep across your book of ${accounts.length} accounts. Use list_accounts first to get the lay of the land, then go deep only on the accounts that deserve attention today. Most accounts on most days, the right move is mark_no_action — but you must call mark_no_action explicitly for every account you considered, so the log is honest.`,
    ``,
    `End by summarizing what you did, drafted, and escalated in 3-4 sentences.`,
  ].join("\n");
}

// ── The loop ─────────────────────────────────────────────────────

export async function runSweep(wake: WakeReason, emit: EventSink): Promise<void> {
  const systemPrompt = loadSystemPrompt();
  const startDay = clock.day();
  const startIso = clock.iso();

  emit({ type: "sweep_started", day: startDay, iso: startIso, trigger: wake });

  // Mark the system prompt as cacheable. Through proxies that support
  // Anthropic-style prompt caching (LiteLLM, Vercel AI Gateway), this
  // makes the system + skills block a cache breakpoint — saves ~80%
  // of input tokens on the second-through-Nth iteration.
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as never],
    } as ChatCompletionMessageParam,
    { role: "user", content: buildUserMessage(wake) },
  ];

  let iteration = 0;
  const MAX_ITERATIONS = 30;

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration += 1;
      emit({ type: "thinking", iteration });

      const response = await llm.chat.completions.create({
        model: MODEL,
        messages,
        tools: toolSchemas,
        tool_choice: "auto",
        max_tokens: 4096,
      });

      const choice = response.choices[0];
      const msg = choice.message;
      messages.push(msg as ChatCompletionMessageParam);

      // Truncation: model ran out of budget mid-decision. Surface it
      // instead of silently treating it as completion.
      if (choice.finish_reason === "length") {
        emit({ type: "error", message: "model hit max_tokens before completing — sweep truncated" });
        emit({
          type: "sweep_finished",
          day: startDay,
          summary: "(truncated — model hit max_tokens)",
          usage: response.usage,
        });
        return;
      }

      // Clean stop or stop with no tool calls → we're done.
      if (choice.finish_reason === "stop" || !msg.tool_calls?.length) {
        const summary = (msg.content as string | null) ?? "(no summary)";
        emit({
          type: "sweep_finished",
          day: startDay,
          summary,
          usage: response.usage,
        });
        return;
      }

      // Execute every tool call in parallel.
      const toolCalls = msg.tool_calls;
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          const fnCall = tc as ChatCompletionMessageToolCall;
          const name = fnCall.function.name;
          let parsedArgs: Record<string, unknown> = {};
          let parseError: string | null = null;
          try {
            parsedArgs = JSON.parse(fnCall.function.arguments || "{}");
          } catch (err) {
            parseError = err instanceof Error ? err.message : String(err);
          }
          emit({ type: "tool_call", name, args: parsedArgs, toolCallId: tc.id });

          let result: unknown;
          if (parseError) {
            // Don't poison state with undefined-keyed entries by handing
            // garbage to the impl. Tell the model its args were bad.
            result = { error: `malformed tool arguments: ${parseError}` };
            emit({ type: "error", message: `tool=${name} arg parse failed: ${parseError}` });
          } else {
            try {
              const impl = toolImpls[name];
              if (!impl) throw new Error(`unknown tool: ${name}`);
              result = await impl(parsedArgs);
            } catch (err) {
              result = { error: err instanceof Error ? err.message : String(err) };
            }
          }
          emit({ type: "tool_result", name, result, toolCallId: tc.id });

          // Side-effect: if this tool maps to a decision, log it.
          const decision = decisionFromTool(name, parsedArgs, result, startIso, startDay);
          if (decision) {
            decisions.log(decision);
            emit({ type: "decision", decision });
          }

          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          };
        }),
      );

      messages.push(...results);
    }

    emit({
      type: "sweep_finished",
      day: startDay,
      summary: "(hit iteration limit before stopping)",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: "error", message });
    emit({ type: "sweep_finished", day: startDay, summary: `error: ${message}` });
  }
}

// Map specific tool calls to user-visible decisions so the dashboard
// can color-code them. mark_no_action and side-channel tools (memory,
// observation) don't emit decisions; the action-shaped tools do.
function decisionFromTool(
  name: string,
  args: any,
  result: any,
  iso: string,
  day: number,
): import("./state.js").Decision | null {
  if (name === "mark_no_action") {
    return {
      ts: iso,
      day,
      accountId: args.account_id,
      action: "no_action",
      summary: args.reason,
    };
  }
  if (name === "draft_renewal_email") {
    return {
      ts: iso,
      day,
      accountId: args.account_id,
      action: "drafted_email",
      summary: `tone=${args.tone}; ${args.key_points?.[0] ?? ""}`,
      details: { tone: args.tone, key_points: args.key_points },
    };
  }
  if (name === "flag_for_human") {
    return {
      ts: iso,
      day,
      accountId: args.account_id,
      action: "escalated",
      summary: args.reason,
      details: { urgency: args.urgency },
    };
  }
  if (name === "note_observation") {
    return {
      ts: iso,
      day,
      accountId: args.account_id,
      action: "logged_observation",
      summary: args.text,
    };
  }
  return null;
}

