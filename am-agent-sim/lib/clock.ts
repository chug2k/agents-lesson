// Controllable fake clock. Every tool that asks for "now" or
// "days until X" pulls from here instead of Date.now() so the
// reader can fast-forward, pause, and scrub time.

const SIM_START = Date.UTC(2026, 3, 1); // 2026-04-01 00:00 UTC
const DAY_MS = 86_400_000;

let simNow = SIM_START;
let tickHandle: ReturnType<typeof setInterval> | null = null;

type TickListener = (day: number, delta: number) => void;
const listeners = new Set<TickListener>();

function defaultDayMs(): number {
  const raw = Number(process.env.SIM_DAY_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}

// Normalize an instant to UTC midnight so "days between" math is
// independent of the wall-clock hour the sim happens to start at.
function utcMidnight(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

export const clock = {
  now(): Date {
    return new Date(simNow);
  },

  day(): number {
    return Math.floor((simNow - SIM_START) / DAY_MS);
  },

  iso(): string {
    return new Date(simNow).toISOString().slice(0, 10);
  },

  daysUntil(isoDate: string): number {
    const target = new Date(isoDate).getTime();
    return Math.round((utcMidnight(target) - utcMidnight(simNow)) / DAY_MS);
  },

  daysSince(isoDate: string): number {
    const past = new Date(isoDate).getTime();
    return Math.round((utcMidnight(simNow) - utcMidnight(past)) / DAY_MS);
  },

  isoDaysAgo(n: number): string {
    return new Date(simNow - n * DAY_MS).toISOString().slice(0, 10);
  },

  advance(days: number): void {
    if (days === 0) return;
    simNow += days * DAY_MS;
    for (const l of listeners) l(clock.day(), days);
  },

  reset(): void {
    clock.stop();
    simNow = SIM_START;
    for (const l of listeners) l(clock.day(), 0);
  },

  start(dayMs = defaultDayMs()): void {
    if (tickHandle) return;
    tickHandle = setInterval(() => clock.advance(1), dayMs);
    tickHandle.unref?.();
  },

  stop(): void {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  },

  isPaused(): boolean {
    return tickHandle === null;
  },

  onTick(fn: TickListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
