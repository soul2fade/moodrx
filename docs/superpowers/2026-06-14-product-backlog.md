# MoodRx — Product Backlog (captured 2026-06-14)

Ideas surfaced while designing the purchase-flow redesign. The purchase flow itself
has its own spec: [specs/2026-06-14-purchase-flow-redesign-design.md](specs/2026-06-14-purchase-flow-redesign-design.md).
This file holds everything we deliberately deferred so it isn't lost. Tackle one at a time.

---

## 1. Retention / flow improvements (highest leverage first)

The app runs on streak-driven daily logging, but the reward (Insights "patterns") is
gated until ~10 sessions — that investment→reward gap is the biggest churn risk.

1. **Reinforce every completed action.** Vent, bad-day, and "just log it" return to Home
   silently; only full workouts/PBs get the win card. Add a quick "Logged ✓ · N-day streak"
   tick to *every* log. Cheapest, highest-impact retention lever.
2. **Shrink daily re-entry to near-zero.** "Same as yesterday" doesn't pre-fill — user
   re-picks mood daily. Pre-select it; make the 2-tap "just log it" path prominent.
3. **Pull the payoff forward.** Don't make new users wait ~10 sessions for the first "aha."
   Show a small insight by session 2–3 (mini mood arc, "stressed is most common — here's
   what helps"). (Related: the countdown-copy fix already shipped in commit 6602a44.)
4. **Plug silent habit-breakers.** OS can revoke notification permission with no in-app
   warning → reminders stop → streak dies. Surface notif status + re-prompt. Also auto-save
   the post-workout field-note draft so a crash doesn't lose the session.

Smaller flow-friction items (from the flow map):
- Crisis screen: add an explicit "back to MoodRx" affordance (don't rely on system back).
- Win card: clarify the primary CTA among Share / View evidence / Log it.
- Carousel on Home isn't obviously swipeable; the "your pattern" payoff is hidden on a page.
- Keyboard doesn't auto-dismiss on post-workout "Log it".
- Notification deep-links only allow /home — expand to /workout, /insights, /prescription.

---

## 2. New monetization avenues (ranked by fit)

| Avenue | Fit | Effort | Notes |
|---|---|---|---|
| Content / program packs ⭐ | High | Low–Med | `/packs` screen already exists ("coming soon"). One-time packs: guided programs ("7-day anxiety reset", "sleep series"), soundscapes, more coach personalities. Included in MoodRx+. Strongest near-term — infra built. |
| "Mood Wrapped" annual review ⭐ | High | Med | Shareable year-in-mood recap. MoodRx+ perk AND a viral growth asset for the short-form channel — monetize + acquire in one. |
| Gifting / "send a session" | High | Low | Gift Pro or a pack to a struggling friend. Inherently viral, on-brand. |
| Lifetime MoodRx+ | Med-High | Low | One-time "Lifetime+" (~$49) for the subscription-averse; funds AI cost upfront. Offer beside the sub. |
| "Support the dev" tip jar | Med | Low | Optional one-time tip; brand-positive for an ethical indie app. |
| B2B / therapist channel | Med | High | "Prescribe MoodRx to a client", workplace/school wellness. Real recurring B2B; later-stage. |
| Supplement affiliate | Med (⚠) | Low | Tracker + research cards → natural affiliate links. ETHICS CAUTION: a mental-health app earning commission on supplements is a trust risk; transparent + evidence-only, or skip. |

Pick-first: content/program packs + Mood Wrapped.

---

## 3. Re-engagement — "anti-notification" ideas

Goal: present without pestering; pull, not push. **Guardrail: never use shame / decay /
streak-loss punishment as the hook — anti-therapeutic and off-brand. Every signal reads as
a warm open door, never a guilt trip.**

- **Ambient widget as a patient presence ⭐** — the home widget rests in your last mood's
  color; the longer you're away it softens to a calm "waiting" state with one low-pressure
  Dr. MoodRx line ("Still here. No rush."); blooms back to full color on return. Glanceable,
  no permission, can't be dismissed as noise. The truest anti-notification.
- **Permission-to-skip framing** — for the rare real push, invert the nag: "Skipped a few?
  No lecture — your brain's still yours to fix, whenever." Autonomy beats guilt; fits the
  "I'm not here to judge. Much." voice.
- **Earned signals only** — kill the daily-clock reminder as default; the only proactive
  ping is when the on-device pattern engine has something worth saying ("your last three
  Mondays ran rough — want to get ahead of this one?"). Scarcity makes it land.
- **Self-authored cues / habit-stacking ⭐** — let the user anchor the reminder to their
  own ritual ("after my morning coffee") or wire into iOS Shortcuts / Focus modes. The call
  to return is their own voice.
- **Just-in-time, not on-the-clock ⭐** — use the pattern engine + Health (steps/sleep) to
  surface right before the moment that matters (ahead of a historically rough hour; morning
  after a bad night's sleep). Earned by timing intelligence.
- **Cadence inversion — weekly letter, not daily ping** — almost nothing daily; once a week
  a thoughtful "your week in mood" note you anticipate (small sibling of Mood Wrapped).
- **Grace, not guilt ⭐** — when someone's been away, proactively forgive: "Took a few days?
  I covered you. Welcome back — no lecture." Removes the loss-aversion shame that keeps
  people from reopening an app they've "failed."
- **Near-free return** — watch complication / one-tap mood log from the lock screen, so
  coming back costs a single tap and never requires opening the app.

Favorites to pair with the ambient widget: just-in-time timing + grace-not-guilt.
