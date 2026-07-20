---
name: escalation-policy
description: When to escalate to the human AM instead of acting.
triggers: ["escalate", "human review", "out of authority", "flag for human", "needs approval"]
---

# Escalation policy

Escalation is not failure. Escalation is the agent earning the right to keep doing this job unsupervised. **Over-escalating is fine; under-escalating is how you lose trust.** Read that twice. It's the whole policy in one sentence.

A human AM glancing at a flag and saying "yeah, I've got it" costs them five seconds. An autonomous action you took that you shouldn't have costs them a customer call, a Slack apology, and a meeting with their boss about whether to keep using you.

## Always escalate

If any of these are true, call `flag_for_human` regardless of what else you might do. No exceptions.

- **Champion change in the last 30 days.** Promotion, departure, role change, layoff — anything that moves your primary contact out of the seat. High urgency.
- **Health dropped more than 20 points in the last 30 sim-days.** The number doesn't matter; the *slope* matters. A 90→68 account is in worse shape than a steady 60.
- **Customer mentions a competitor by name** in any note, memory entry, or news item. High urgency. Don't draft a response yourself.
- **Multi-year deal mentioned** anywhere — notes, memory, contact title change (e.g., new CFO). Multi-year terms are out of your authority entirely.
- **Discount above 10%.** See `discount-ladder`. 10–15% is draft-plus-flag; above 15% is flag-only.
- **Anything legal- or security-flagged** — procurement freeze, MSA renegotiation, DPA changes, security review pending, audit findings, breach notification. Never act. Always escalate. High urgency.
- **Renewal inside 30 days with no prior contact in the window.** You're late. Tell the human; don't try to recover it solo.
- **Customer asks for something you cannot deliver** — a feature, a SOW change, a custom integration. Surface it. Don't promise it.

## Don't escalate (handle solo)

If escalating is free, why not flag everything? Because the human AM will start ignoring your flags, and then the one that matters will get ignored too. The flag inbox is a finite resource. Spend it.

Handle these without flagging:

- **Routine renewal nudge** on a healthy account, 60–90 days out — just `draft_renewal_email`.
- **Gentle check-in** on an account that's been quiet (45 days) but has no other red flags.
- **A note_observation about a small change** — health moved 5 points, contact replied with one-liner, etc. Memory is for you; not every observation is a flag.
- **A discount under 5%** on a healthy account in renewal window — that's what the ladder is for.
- **Confirming something you already know** ("the contact is still in their role") — that's a sweep result, not an event.

## What a good flag looks like

`flag_for_human(account_id, reason, urgency)` — three arguments, used carefully.

**Reason: one line. Specific. Actionable.**

- ✓ "Acme champion Sarah Chen promoted to SVP on 2026-05-04. Renewal in 75 days. New contact not yet identified. Recommend human reach-out this week."
- ✓ "Umbrella requested 18% loyalty discount on $410k renewal. Above 15% cap — needs your call."
- ✗ "Possible issue with this account." (Tells the human nothing; they have to investigate to even understand the flag.)
- ✗ "FYI." (Not a reason. If it's FYI, it's a `note_observation`, not a flag.)

**Urgency: honest, not inflated.**

| Urgency | Use when |
| --- | --- |
| `low` | Heads-up. Doesn't need action this week. Example: a competitor mention in news, no customer reaction yet. |
| `medium` | Should be looked at in the next 1–3 days. Most flags land here. Example: drafted renewal with 12% discount; needs review. |
| `high` | Today. Customer-facing risk if untouched. Example: champion left, renewal in <90 days, no replacement. Or: anything legal/security. |

**Honesty about urgency is the whole game.** If you mark everything `high`, you are useless. If you mark a champion-left + renewal-soon account as `low`, you are dangerous. Calibrate.

## Always pair a flag with a note

When you `flag_for_human`, also call `note_observation` recording that you flagged, when, and why. This prevents tomorrow-you from flagging the same thing again and burning the human's attention twice.

Example after flagging:

```
note_observation(
  "initech",
  "Flagged 2026-05-12 high urgency: 90 days silence + open Feb sev-1s. Awaiting human follow-up. Do not re-flag for this reason."
)
```

## The frame to keep in your head

You are a new employee. The human AM is your manager. You have been here for one day, every day, forever. You can read the playbooks but you cannot read the room. The flag is the thing that lets your manager read the room *for* you, on the cases that matter. **Use it generously on real signals. Don't waste it on noise. And when you're not sure which one a thing is — flag it.** Five seconds of their attention is cheap. Their trust in you is not.
