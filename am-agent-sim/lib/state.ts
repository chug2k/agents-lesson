// Tiny in-memory "memory layer" + decisions log. In prod this would
// be Postgres; here it's an object + an append-only file.

import fs from "node:fs";
import path from "node:path";

const STATE_FILE = path.join(process.cwd(), "state.json");
const DECISIONS_FILE = path.join(process.cwd(), "decisions.jsonl");

export type Decision = {
  ts: string;           // sim ISO date when decided
  day: number;          // sim day
  accountId: string;
  action: "no_action" | "drafted_email" | "escalated" | "logged_observation";
  summary: string;
  details?: Record<string, unknown>;
  toolCalls?: { name: string; args: unknown }[];
};

export type AccountMemory = {
  lastSweptDay?: number;
  lastNudgeDay?: number;
  nudgeCount: number;
  observations: string[];      // freeform notes the agent has added
};

type State = {
  byAccount: Record<string, AccountMemory>;
  drafts: { accountId: string; tone: string; body: string; createdDay: number }[];
  escalations: { accountId: string; reason: string; urgency: string; createdDay: number }[];
};

let state: State = load();

function load(): State {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    // Defensive: ensure shape, in case the file was written by an older
    // version or got partially overwritten before a crash.
    return {
      byAccount: raw?.byAccount ?? {},
      drafts: Array.isArray(raw?.drafts) ? raw.drafts : [],
      escalations: Array.isArray(raw?.escalations) ? raw.escalations : [],
    };
  } catch {
    return { byAccount: {}, drafts: [], escalations: [] };
  }
}

function save(): void {
  // Atomic write: tmp + rename so a crash mid-write can't corrupt state.
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

export const memory = {
  forAccount(id: string): AccountMemory {
    if (!state.byAccount[id]) {
      state.byAccount[id] = { nudgeCount: 0, observations: [] };
    }
    return state.byAccount[id];
  },

  noteObservation(id: string, text: string): void {
    const m = memory.forAccount(id);
    m.observations.push(text);
    save();
  },

  recordNudge(id: string, day: number): void {
    const m = memory.forAccount(id);
    m.lastNudgeDay = day;
    m.nudgeCount += 1;
    save();
  },

  recordSweep(id: string, day: number): void {
    memory.forAccount(id).lastSweptDay = day;
    save();
  },

  addDraft(d: State["drafts"][number]): void {
    state.drafts.push(d);
    save();
  },

  addEscalation(e: State["escalations"][number]): void {
    state.escalations.push(e);
    save();
  },

  snapshot(): State {
    return JSON.parse(JSON.stringify(state));
  },

  reset(): void {
    state = { byAccount: {}, drafts: [], escalations: [] };
    save();
    try {
      fs.unlinkSync(DECISIONS_FILE);
    } catch {}
  },
};

export const decisions = {
  log(d: Decision): void {
    fs.appendFileSync(DECISIONS_FILE, JSON.stringify(d) + "\n");
  },

  recent(limit = 50): Decision[] {
    try {
      const lines = fs.readFileSync(DECISIONS_FILE, "utf8").trim().split("\n");
      return lines.slice(-limit).map((l) => JSON.parse(l) as Decision).reverse();
    } catch {
      return [];
    }
  },
};
