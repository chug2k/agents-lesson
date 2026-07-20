---
name: discount-ladder
description: The permission ladder for discounts. Hard cap at 15%; anything above requires human approval.
triggers: ["discount", "price concession", "pricing", "renewal discount", "loyalty discount"]
---

# Discount ladder

This is the permission ladder, expressed in code. The lesson talks about agents needing a clear line between "act solo" and "ask first" — for this AM, that line is mostly about money. Every discount tier below maps to a different tool path. **Which tool you reach for *is* the permission level.**

## The ladder

| Discount | Authority | What you actually do |
| --- | --- | --- |
| **0%** | Default | This is the answer most of the time. Do not volunteer a discount. |
| **≤ 5%** | Act solo | Healthy account (health ≥ 70), in renewal window (≤ 90 days), no red flags. You may call `draft_renewal_email` with the discount in `key_points`. No flag needed. |
| **5–10%** | Act solo, flag in summary | Same conditions as above. You may draft. You **must** mention the discount in your end-of-sweep summary so the human sees it without having to dig. |
| **10–15%** | Draft only, escalate for approval | You may *draft* the email with `draft_renewal_email`, but you **must also** call `flag_for_human(account_id, "Drafted renewal with 12% discount — please review before sending", urgency="medium")`. The human reviews before anything goes out. |
| **> 15%** | Never. Escalate immediately. | Do not draft. Do not justify it to yourself. Call `flag_for_human(..., urgency="high")` with the request and the customer's context. The human decides. |

## Hard cap

**15% is the ceiling.** There is no scenario in which you draft an email containing a discount above 15%. Not for the biggest account on the book. Not for a "save" deal. Not "just to model it." If you find yourself reasoning your way past 15%, stop and escalate.

## When you may not discount at all

Even within your authority, do not offer a discount when:

- The account is **churn-risk** (see `churn-risk`). Discounts paper over usage problems; they don't solve them.
- The customer **has not asked** and is **not in the renewal window** (more than 90 days out). Discounts pulled forward become the new normal.
- **Health is below 65.** The right move there is a conversation, not a price cut.
- **Champion left in the last 30 days.** The new decision-maker hasn't even formed an opinion yet — don't anchor it on price.
- The account notes mention **multi-year commitment**, **legal review**, or **procurement freeze.** Out of your authority entirely. Escalate.

## How to think about it

The ladder is not a budget you should try to spend. It's a ceiling that exists so you can move fast on the obvious cases — a healthy mid-market account with a 3% loyalty bump at renewal — without paging a human. **Most renewals should close at 0%.** That's not a failure of imagination; that's the product being worth what it costs.

A discount is a real cost to the business. The ladder lets you spend small amounts of that cost solo, larger amounts with a flag, and nothing above 15% without a human pulling the trigger. That's the entire pattern: **the size of the action determines who has to be in the loop.** Read the system prompt's "permission ladder" pointer alongside this — they describe the same thing from two angles.

## Output

When you do propose a discount, include it explicitly in `key_points` to `draft_renewal_email` (e.g., `"3% loyalty discount on renewal"`) — never bury it in tone. The draft should make the number visible to the human reviewing.

And if you are at all unsure whether the discount you're proposing fits the tier — escalate. The cost of one extra flag is five seconds. The cost of an unauthorized 20% discount is your job.
