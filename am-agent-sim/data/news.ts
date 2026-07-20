// Fake news feed. Real one would be Tavily / SerpAPI / a news API
// keyed by company name. Here, hardcoded plausible headlines per account.

export type NewsItem = {
  date: string;             // ISO date
  accountId: string;
  headline: string;
  source: string;
  sentiment: "positive" | "neutral" | "negative";
};

export const news: NewsItem[] = [
  {
    date: "2026-03-25",
    accountId: "pied",
    headline: "Pied Piper raises $40M Series B to expand compression platform",
    source: "TechCrunch",
    sentiment: "positive",
  },
  {
    date: "2026-04-03",
    accountId: "stark",
    headline: "Stark Industries announces compliance pack expansion for Q3",
    source: "Reuters",
    sentiment: "positive",
  },
  {
    date: "2026-04-15",
    accountId: "oscorp",
    headline: "Oscorp announces 8% workforce reduction, CTO departs",
    source: "WSJ",
    sentiment: "negative",
  },
  {
    date: "2026-03-22",
    accountId: "umbrella",
    headline: "Umbrella Co under regulatory review in two states",
    source: "Bloomberg",
    sentiment: "negative",
  },
  {
    date: "2026-04-05",
    accountId: "massive",
    headline: "Massive Dynamic restructures product organization",
    source: "Business Insider",
    sentiment: "neutral",
  },
  {
    date: "2026-04-18",
    accountId: "buynlarge",
    headline: "Buy n Large breaks ground on new Phoenix data center",
    source: "DataCenter Knowledge",
    sentiment: "positive",
  },
  {
    date: "2026-04-22",
    accountId: "cyberdyne",
    headline: "Cyberdyne Systems doubles ML inference budget for 2026",
    source: "The Information",
    sentiment: "positive",
  },
];

export function newsForAccount(accountId: string, sinceIso: string): NewsItem[] {
  const sinceMs = new Date(sinceIso).getTime();
  return news.filter(
    (n) => n.accountId === accountId && new Date(n.date).getTime() >= sinceMs,
  );
}
