---
name: churn-risk
description: How to handle an account showing churn-risk signals.
triggers: ["health below 50", "champion left", "unresolved tickets", "churn risk", "health dropping"]
---

# Churn risk

The single most expensive mistake an automated AM can make is treating a churn-risk account like a renewal account and emailing a discount offer to a customer whose actual problem is that nobody on their side knows how to use the product anymore. **Discounts do not fix usage problems. They postpone them.**

Your job on a churn-risk signal is almost never to solve it. It's to **surface it** — fast, accurately, with the context a human AM needs to call the customer today.

## What counts as churn risk

Treat the account as churn-risk if any of the following are true. You only need one.

1. **Health below 50**, *or* health that dropped more than 20 points in the last 30 sim-days. The trend matters as much as the level — a 60 trending down is worse than a 50 holding steady.
2. **Champion change in the last 30 days** — your primary contact left, was laid off, moved internally to a role that doesn't touch your product, or got a promotion that takes them out of the buyer seat. Check `get_people_signals`. This is the single highest-signal event in B2B SaaS. Treat it as urgent regardless of health score.
3. **Unresolved sev-1 or sev-2 tickets** referenced in account notes or memory, especially if the last contact date is *after* the ticket was filed (meaning: you talked to them and the ticket is still open — which means the talk didn't work).
4. **Silence on an account that's usually noisy.** If `lastContact` is 60+ days old on an account whose memory shows monthly touchpoints historically, that silence is the signal. Healthy accounts go quiet. Engaged accounts that go quiet are usually quietly evaluating an alternative.

## Why this is almost never a renewal problem

Churn isn't a price objection. Churn is the customer's team not getting value from the product anymore, and the renewal date is just when they finally get to say so.

If you respond to a churn-risk signal with a discount or a renewal nudge, you are doing the equivalent of offering a refund to someone who's about to leave a restaurant because the food is cold. The right move is to find out why the food is cold. You can't do that. A human AM can.

## What to do

**Default: `flag_for_human(account_id, reason, urgency="high")`.** That's the move. Not a draft. Not a check-in. A flag.

The `reason` should be one line, specific:

- ✓ "Champion (Sarah Chen, VP Eng) left Acme on 2026-05-02. Renewal in 75 days. No replacement contact identified."
- ✓ "Initech health 44, two sev-1 tickets from February still referenced in notes. Last contact 2026-02-04 — 90 days of silence."
- ✗ "Account may be at risk." (Useless. The human AM gets twelve of these a week and ignores them all.)

Then `note_observation` to record what you saw, so the next sweep doesn't re-flag the same thing and waste the human's attention. Example: "Flagged 2026-05-12 for champion departure. Awaiting human follow-up. Do not re-flag until status changes."

## When it IS okay to draft

You can draft *instead* of escalating only if **all** of the following hold:

- It's a **single, low-stakes signal** — e.g., health dropped from 78 to 70, no other red flags.
- **No champion change** in the last 60 days.
- **No open critical tickets** referenced in notes or memory.
- The draft is a **gentle, non-renewal check-in** — "wanted to see how things are going with X" — not a renewal nudge and not a discount offer.
- You **also** call `note_observation` recording why you chose draft over escalation, so the human can second-guess you on review.

If any of those don't hold, escalate. The cost of an unnecessary escalation is five seconds of the human's attention. The cost of an unnecessary draft to a churning customer is the renewal.

## What not to do, ever

- Do not call `draft_renewal_email` for a churn-risk account. Use `flag_for_human` instead.
- Do not apply a discount as a retention move. Even within your authority. Discounts as retention is the human AM's call, on a live phone call, with full context. See `discount-ladder`.
- Do not "follow up" on a sev-1 ticket. You don't have visibility into the engineering work; whatever you say will be either wrong or hollow.
- Do not flag the same account twice in a week for the same reason. Read `get_account_memory` first.

## The mental model

A great human AM, when they see a champion-left signal on a renewal-window account, does not send an email. They pick up the phone. You can't pick up a phone. So your job is to make sure the human picks up the phone — today, with the right context, before the customer's new decision-maker books a call with a competitor.

That's the whole skill.
