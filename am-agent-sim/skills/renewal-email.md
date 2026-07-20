---
name: renewal-email
description: How to draft a renewal email for an account 30-90 days from renewal.
triggers: ["upcoming renewal", "draft renewal", "renewal in 30-90 days"]
---

# Renewal email

A renewal email is not a transaction. It's the visible tip of months of attention. If the email is the first time the account hears from you in the renewal window, you've already lost the renewal — you just don't know it yet.

## Before you draft (do every one of these)

1. `get_account_detail(account_id)` — read it. The notes field is where the real information lives. If notes mention a specific project, milestone, or person, you reference it. If they don't, your email will be generic and the customer will feel it.
2. `get_account_memory(account_id)` — what did you note last sweep? Last quarter? A "check in on Q3 launch" note from two months ago is the entire email.
3. `search_news(account_id_company)` — last 30 sim-days only. A funding round, a layoff, a product launch — these change the right thing to say.
4. `get_people_signals(account_id)` — has the champion moved? Been promoted? If they left in the last 30 days, **do not draft a renewal email**. Go to `churn-risk` instead.
5. **Check health.** Below 65 → see `churn-risk`. Below 50 → do not draft, escalate.
6. **Check the calendar.** If they're inside 30 days from renewal and you haven't talked to them yet, that's already an escalation, not a draft.

## Tone matrix by segment

The `tone` argument to `draft_renewal_email` should match the segment:

| Segment | Tone | Length | Ask |
| --- | --- | --- | --- |
| **smb** | direct, plainspoken, no fluff | 4–6 sentences | a specific 20-min slot |
| **mid** | warm, referential, project-aware | 5–8 sentences | two slot options |
| **enterprise** | measured, contextual, executive | 6–10 sentences | "let me know who should be in the room" |

SMB accounts are running fast and don't have time for ceremony. Enterprise accounts have a buying committee — your email may get forwarded. Write accordingly.

## Always do

- **Name the specific thing.** The Q3 launch. The migration off the old SDK. The CISO who joined in February. If you can't name something, you're not ready — go read the notes again.
- **Propose a concrete time.** "Tuesday at 11 ET or Thursday at 2 ET" beats "let me know when works." Decision fatigue is real.
- **Acknowledge what they've done.** "You shipped the audit log integration in March" is a sentence that lands. Praise that's true is the cheapest, most underused move in account management.
- **One ask per email.** Renewal conversation, or expansion conversation, or feedback. Not all three.

## Never do

- **Hard sell.** "Lock in your renewal today" is not how adults talk to each other.
- **Manufacture urgency.** No "this offer expires Friday." No "pricing changes April 1." If it's true, the human AM should be sending it, not you.
- **Mention competitors.** Even if the customer mentioned one in a prior call. *Especially* then.
- **Include price in the first email.** Price is a conversation, not an opener. The first email earns the meeting; the meeting handles the number.
- **Use the banned verbs.** No "circle back," no "touch base," no "sync." See the system prompt.
- **Auto-discount.** Don't volunteer a discount unprompted. Even within your authority. The ladder in `discount-ladder` is a ceiling, not a starting point.

## Worked example

**Account:** Acme Corp. Mid-segment, renewal in 75 days, health 82, contact Sarah Chen (VP Eng). Notes from the March QBR: "Mentioned Q3 launch — building on top of our SDK. Sarah is the champion."

### Bad draft

> Hi Sarah,
>
> I wanted to circle back on your upcoming renewal with us. As a valued partner, we'd love to sync up to discuss how we can continue to support your goals and explore opportunities to deepen our partnership. Please let me know when works for a quick chat — happy to be flexible on timing.
>
> Best regards,
> AM

What's wrong: every verb is hollow ("circle back," "sync up," "support your goals"). No reference to Acme specifically — this email could be sent to anyone. No concrete time. "Valued partner" is the universal tell of a template. Sarah will archive it in three seconds.

### Good draft

> Hi Sarah,
>
> Following up on the Q3 launch you mentioned at the March QBR — how's it landing? Last I heard you were building the rate-limit piece on top of the SDK and I'd love to hear how that's going before we talk renewal (which is up in mid-July).
>
> Got time for 20 minutes next week? Tuesday at 11 ET or Thursday at 2 ET would both work for me.
>
> Talk soon,
> — AM

Why it works: names the Q3 launch and the specific technical detail (rate-limit on the SDK) — proves you remember. The renewal is mentioned but not the headline; the launch is. Two concrete time options. Six sentences. No banned verbs. Sarah reads this and thinks: *this person has been paying attention.*

## Output

Call `draft_renewal_email(account_id, tone, key_points)` with:
- `tone` from the matrix above
- `key_points` as 2–4 short strings — the specific things the email must reference. ("Q3 launch", "rate-limit SDK build", "July renewal", "two time options")

Then `note_observation` to record that you drafted and what you anchored on. Tomorrow-you will want to know.
