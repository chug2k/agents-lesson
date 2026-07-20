// Fake people-intelligence feed. Job changes, promotions, departures
// for contacts at the accounts. Date-stamped — the agent should only
// consider recent signals (e.g., last 60 days from the sim clock).
//
// In production this is a Clay / LinkedIn Sales Navigator / similar
// enrichment feed. In the sim, plain JS.

export type PeopleSignal = {
  date: string;             // ISO date
  accountId: string;
  person: string;
  signal: "job_change" | "promotion" | "departure" | "title_change" | "linkedin_post";
  detail: string;
};

export const peopleSignals: PeopleSignal[] = [
  {
    date: "2026-04-12",
    accountId: "monarch",
    person: "Cate Russell",
    signal: "departure",
    detail: "Champion at Monarch. New role at competitor as VP Data. LinkedIn updated.",
  },
  {
    date: "2026-03-30",
    accountId: "initech",
    person: "Michael Bolton",
    signal: "linkedin_post",
    detail: "Posted about evaluating new vendor stack. Vague but not encouraging.",
  },
  {
    date: "2026-04-02",
    accountId: "stark",
    person: "Pepper Potts",
    signal: "promotion",
    detail: "Promoted from CFO to COO. Bigger budget purview.",
  },
  {
    date: "2026-03-18",
    accountId: "tyrell",
    person: "Eldon Tyrell",
    signal: "title_change",
    detail: "Title now 'VP Platform & Infra' — scope expanding.",
  },
  {
    date: "2026-04-20",
    accountId: "oscorp",
    person: "Norman Osborn",
    signal: "departure",
    detail: "Out at Oscorp. Reason not public. Backup contact has not been established.",
  },
  {
    date: "2026-03-25",
    accountId: "pied",
    person: "Richard Hendricks",
    signal: "linkedin_post",
    detail: "Pied Piper closed Series B. $40M. Posted about scaling the team.",
  },
  {
    date: "2026-04-08",
    accountId: "weyland",
    person: "Carter Burke",
    signal: "promotion",
    detail: "Promoted to VP Product Ops at Weyland. First major win in new role.",
  },
  {
    date: "2026-04-25",
    accountId: "duff",
    person: "Larry Burns",
    signal: "job_change",
    detail: "Left Duff. New role at unrelated company. Replacement not yet announced.",
  },
  {
    date: "2026-04-30",
    accountId: "krustyco",
    person: "Herschel Krustofski",
    signal: "linkedin_post",
    detail: "Posted about 'tightening the belt this quarter.'",
  },
];

export function signalsForAccount(accountId: string, sinceIso: string): PeopleSignal[] {
  const sinceMs = new Date(sinceIso).getTime();
  return peopleSignals.filter(
    (s) => s.accountId === accountId && new Date(s.date).getTime() >= sinceMs,
  );
}
