// Express server + SSE. Serves the dashboard, exposes REST endpoints,
// streams agent events to the browser. Holds the fake clock + the
// "is a sweep running" lock.

import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { clock } from "./lib/clock.js";
import { memory, decisions } from "./lib/state.js";
import { accounts } from "./data/accounts.js";
import { runSweep, type AgentEvent, type WakeReason } from "./lib/agent.js";
import { toolSchemas, toolImpls } from "./lib/tools.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = process.cwd();

// ── SSE fan-out ──────────────────────────────────────────────────

type SSEClient = { id: number; res: Response };
const sseClients = new Set<SSEClient>();
let sseId = 0;

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) {
    try {
      c.res.write(payload);
    } catch {
      // Client socket died — evict so the next broadcast doesn't throw again.
      sseClients.delete(c);
    }
  }
}

function emitAgent(e: AgentEvent) {
  broadcast(e.type, e);
}

// ── Sweep lock ───────────────────────────────────────────────────

let sweepRunning = false;

async function startSweep(wake: WakeReason): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    await runSweep(wake, emitAgent);
    broadcast("state_changed", { reason: "sweep_finished" });
  } finally {
    sweepRunning = false;
  }
}

// ── Clock → daily sweep wiring ──────────────────────────────────

clock.onTick((day, delta) => {
  broadcast("clock_tick", { day, iso: clock.iso() });
  // Only sweep on forward time. Scrubbing backwards or resetting
  // shouldn't burn LLM calls re-running past sim-days.
  if (delta > 0 && !sweepRunning) {
    void startSweep({ kind: "daily_sweep" });
  }
});

// ── REST endpoints ───────────────────────────────────────────────

app.get("/api/state", (_req, res) => {
  const mem = memory.snapshot();
  const accountsView = accounts.map((a) => {
    const m = mem.byAccount[a.id];
    return {
      id: a.id,
      name: a.name,
      segment: a.segment,
      renewal: a.renewal,
      daysToRenewal: clock.daysUntil(a.renewal),
      health: a.health,
      lastContact: a.lastContact,
      daysSinceLastContact: clock.daysSince(a.lastContact),
      lastSweptDay: m?.lastSweptDay ?? null,
    };
  });

  const counts = {
    healthy: accountsView.filter((a) => a.health >= 70).length,
    attention: accountsView.filter((a) => a.health >= 50 && a.health < 70).length,
    critical: accountsView.filter((a) => a.health < 50).length,
  };

  res.json({
    clock: { day: clock.day(), iso: clock.iso(), paused: clock.isPaused() },
    accounts: accountsView,
    recentDecisions: decisions.recent(80),
    drafts: mem.drafts.slice(-20),
    escalations: mem.escalations.slice(-20),
    counts,
    sweepRunning,
  });
});

app.post("/api/sweep", async (_req, res) => {
  if (sweepRunning) return res.status(409).json({ error: "sweep already running" });
  res.json({ started: true });
  void startSweep({ kind: "manual_sweep" });
});

app.post("/api/event", async (req, res) => {
  const { type, accountId, detail } = req.body as {
    type: string;
    accountId?: string;
    detail?: string;
  };
  if (!type) return res.status(400).json({ error: "type required" });
  res.json({ accepted: true });
  void startSweep({ kind: "event", eventType: type, accountId, detail });
});

app.post("/api/clock", (req, res) => {
  const { action, days } = req.body as { action: string; days?: number };
  switch (action) {
    case "jump":
      clock.advance(Number(days ?? 1));
      break;
    case "pause":
      clock.stop();
      break;
    case "resume":
      clock.start();
      break;
    case "reset":
      clock.reset();
      memory.reset();
      broadcast("state_changed", { reason: "reset" });
      break;
    default:
      return res.status(400).json({ error: `unknown action: ${action}` });
  }
  res.json({ ok: true, clock: { day: clock.day(), iso: clock.iso(), paused: clock.isPaused() } });
});

app.get("/api/prompts", (_req, res) => {
  const system = readSafe(path.join(ROOT, "prompts/system.md"));
  const skillsDir = path.join(ROOT, "skills");
  const skills = fs
    .readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({
      name: f.replace(/\.md$/, ""),
      content: readSafe(path.join(skillsDir, f)),
    }));
  res.json({ system, skills });
});

app.put("/api/prompts", (req, res) => {
  const { system, skills } = req.body as {
    system?: string;
    skills?: { name: string; content: string }[];
  };
  if (typeof system === "string") {
    fs.writeFileSync(path.join(ROOT, "prompts/system.md"), system);
  }
  if (Array.isArray(skills)) {
    for (const s of skills) {
      if (!/^[a-z0-9-]+$/.test(s.name)) continue;
      fs.writeFileSync(path.join(ROOT, "skills", `${s.name}.md`), s.content);
    }
  }
  res.json({ saved: true });
});

// ── Tool playground ──────────────────────────────────────────────
// A tool is just an API the agent calls. These endpoints let a human
// call the exact same functions directly — same schemas, same impls,
// same results. This is what the agent does internally on each turn.

app.get("/api/tools", (_req, res) => {
  res.json({
    tools: toolSchemas.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  });
});

app.post("/api/tool", async (req, res) => {
  const { name, args } = req.body as { name: string; args?: Record<string, unknown> };
  const impl = toolImpls[name];
  if (!impl) return res.status(404).json({ error: `unknown tool: ${name}` });
  try {
    const result = await impl(args ?? {});
    // A direct call can mutate state (drafts, escalations, memory) just
    // like the agent's call would — refresh the dashboard's view.
    broadcast("state_changed", { reason: "tool_call" });
    res.json({ name, args: args ?? {}, result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/stream", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  const client: SSEClient = { id: ++sseId, res };
  sseClients.add(client);

  req.on("close", () => {
    sseClients.delete(client);
  });
});

// ── Dashboard static files ───────────────────────────────────────

const dashboardDir = path.join(ROOT, "dashboard");
app.use(express.static(dashboardDir));
app.get("/", (_req, res) => res.sendFile(path.join(dashboardDir, "index.html")));

// ── boot ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.anthropic.com/v1/";
  const hasKey = !!process.env.LLM_API_KEY;
  console.log(`\nAM agent sim — http://localhost:${PORT}`);
  console.log(`  model:      ${process.env.LLM_MODEL ?? "claude-sonnet-4-6"}`);
  console.log(`  endpoint:   ${baseUrl}`);
  console.log(`  api key:    ${hasKey ? "set" : "MISSING — set LLM_API_KEY in .env"}`);
  console.log(`  sim day:    ${clock.iso()} (day ${clock.day()})`);
  console.log(``);
});

function readSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
