# Purchase-flow redesign — design spec

**Date:** 2026-06-14
**Status:** Approved in brainstorming; ready for implementation planning.
**Goal:** Reduce purchase friction and cognitive load — "users don't have to think much."
Make buying feel safe, legible, and one-decision-at-a-time, and add a recurring-revenue
tier that funds the app's ongoing AI/cloud cost without making the whole app a subscription.

Backlog of deferred ideas (retention, other monetization, re-engagement):
[../2026-06-14-product-backlog.md](../2026-06-14-product-backlog.md).

---

## 1. Pricing architecture (decided)

| Tier | Price | What it includes |
|---|---|---|
| **Free** | — | Hook: limited workouts, on-device voice venting, a taste of the stock-copy coach |
| **MoodRx (own it)** | **$9.99 one-time** | Full app + the **stock-copy** Dr. MoodRx coach, forever. Zero ongoing cost to run. |
| **Voices** | **$0.99 each / $2.99 all** (one-time) | À la carte at the Coach-voice picker. Included with MoodRx+. |
| **MoodRx+** | **$3.99/mo or $24.99/yr, 7-day free trial** | The recurring-cost layer: **live** Dr. MoodRx AI coach, all voices, new content packs, cloud niceties. The MRR engine. |

**Why this split:** the live AI coach (Anthropic Haiku via Netlify) + cloud STT have real
per-user marginal cost, so they sit behind recurring revenue. The static core is owned
once — low-friction, on-brand for a privacy/ethics-led mental-health app, and it captures
impulse buyers from short-form-video traffic. The product already distinguishes **stock
copy** (free/owned, no marginal cost) from the **live AI coach** (costs per call), so the
$9.99-vs-MoodRx+ line is natural — not a takeaway. Pre-launch, so no existing buyers to
migrate.

**Rationale recap:** pure one-time = best conversion but no MRR and unfunded AI cost; pure
subscription = MRR but high churn and off-brand for wellness; this hybrid balances all three.

---

## 2. Principles ("A + core of B")

1. **Every purchase feels safe (A).** Each buy button has explicit loading + success states
   and is disabled/skeleton until RevenueCat offerings load — no frozen-looking taps, no
   dead taps, no silent post-purchase.
2. **One offer, shown the same way everywhere (core of B).** A single canonical line —
   **"Unlock everything — $9.99 once. No subscription."** — reused verbatim; price always
   visible *on the lock itself* before any tap. The user learns the deal once.
3. **One decision at a time (sequencing).** Never stack two paid decisions. Onboarding sells
   only the $9.99. Voices appear only at the voice picker. MoodRx+ appears only at the
   live-AI moment of value. The main paywall sells exactly one thing.

---

## 3. Onboarding (first-run)

**Philosophy:** don't hard-gate cold/video traffic — let them in, present the $9.99 as a
clear option, and rely on moment-of-value conversion later. **MoodRx+ is NOT shown here.**

Keep the existing hook + narrative. Redesign the decision screen:
- Headline: "Own MoodRx."
- Value line: "Every workout, your patterns, your coach — yours forever."
- Proof at the pitch: the before→after example ("−3 pts"; personalized once sessions exist).
- Reassurance, prominent (the differentiator): "$9.99 once. No subscription. No auto-renew."
- Primary CTA (bold, full-width): "Own it — $9.99" → with loading + success states.
- Secondary (quiet text link, NOT an equal button): "Start free →".

Fixes vs today: free is no longer an equal-weight button shown after Pro is buried; price +
proof + reassurance now lead the decision.

---

## 4. The offer sheet (the $9.99 paywall)

One shared sheet used at every Pro lock (replaces the inconsistent PremiumSheet entries).
Top to bottom:
- **Contextual headline** by entry point ("Unlock all 18 workouts" / "See your full
  patterns" / "Unlock the supplement tracker").
- **Value line + canonical reassurance** (same words everywhere): "$9.99 once · no
  subscription · yours forever."
- **Proof carried into the sheet** — avg shift, or the −3 pts example. The decision happens
  here, so the proof belongs here (today it only lives on the standalone premium screen).
- **Primary button with real states:** "Unlock everything · $9.99" → spinner/"Processing…"
  → on success flips to "You're in ✓", sheet closes, and **drops the user straight into the
  thing they unlocked** (tapped a locked workout → it opens).
- **Disabled/skeleton until offerings load.**
- **Quiet footer:** "Restore purchase" + "Maybe later."
- **No MoodRx+ here** — the sheet sells one thing.

---

## 5. MoodRx+ — surfaced at the moment of value

Never at first run. Appears when the **live** AI coach proves its worth ("show, don't tell"):
- **Free taste, then convert:** every owner gets a small taste of the *live* coach (e.g. a
  few live replies, or once/week). When the taste runs out: a contextual sheet — "Dr. MoodRx
  wrote that for you, live. Keep the live coach + every voice + new content."
- **The MoodRx+ sheet:** lead with the **7-day free trial**, then **$3.99/mo**, with
  **$24.99/yr (save ~half)** as the smart-money option.
- **Secondary entries:** a calm "Included with MoodRx+" line on the voice picker; an upgrade
  row on the premium/settings screen. Same sheet everywhere.

(Exact taste limit — e.g. N live replies total, or once/week — to be set during planning;
default proposal: a small lifetime taste of ~3 live replies, then the prompt.)

---

## 6. Cross-cutting

- **One locked-state, everywhere:** every gated feature shown dimmed + a small price chip
  ("$9.99 unlocks this") that opens the offer sheet. Replaces the grab-bag of "UNLOCK PRO →",
  "[PRO]", "+N MORE PATTERNS" treatments.
- **Voice picker (tiered model C):** each voice row gets **Sample** + a **"$0.99"** buy; a
  **"All voices · $2.99"** button; and a quiet **"Included with MoodRx+ →"**. Sample→buy is
  the impulse moment.
- **Loading + success on EVERY buy button** (base unlock, $0.99 voice, $2.99 bundle,
  MoodRx+, restore): spinner → "✓" → land in the unlocked thing. Highest-ROI fix; universal.

---

## 7. RevenueCat / product changes

- Keep the existing **$9.99 lifetime** base entitlement (`premium`).
- Add **per-voice non-consumables** (`voice_<name>`, $0.99 each) + the existing
  **`voice_pack`** as the "all voices · $2.99" bundle; entitlement check = owns-bundle OR
  owns-that-voice OR MoodRx+ active.
- Add **MoodRx+ subscription** products (monthly $3.99 + annual $24.99) with a 7-day intro
  trial, entitlement `plus` (or reuse the scaffolded `all_access`). MoodRx+ grants: live AI
  coach + all voices + content packs.
- **Re-gate the live AI coach** behind MoodRx+ (today it's under the $9.99 `premium`); the
  $9.99 keeps the stock-copy coach. Confirm copy/strings so this reads as "live upgrade,"
  not "removed."

---

## 8. Build order (ship in phases; each can be its own plan)

1. **Phase A — confidence polish (no new products):** loading + success states on all
   existing buy buttons + disable-until-offerings-loaded. Pure win, no pricing change.
2. **Phase B — consistency:** canonical offer copy + price-on-the-lock chips + consolidate
   upsell entries onto one offer sheet with proof carried in.
3. **Phase C — voices à la carte:** per-voice $0.99 + $2.99 bundle at the picker (RevenueCat
   products + picker UI).
4. **Phase D — onboarding redesign.**
5. **Phase E — MoodRx+ subscription:** products + trial, re-gate live AI coach, moment-of-
   value sheet + secondary entries.

Phases A–B deliver most of the "don't make me think" win with zero pricing risk; C–E add the
revenue architecture.

---

## 9. Out of scope (see backlog)

Retention/flow fixes, other monetization avenues (content packs, Mood Wrapped, gifting,
lifetime+, B2B, affiliate), and the "anti-notification" re-engagement set are tracked
separately in [../2026-06-14-product-backlog.md](../2026-06-14-product-backlog.md).

## 10. Testing notes

- Pure pricing/entitlement logic (which tier unlocks what; owns-voice OR bundle OR plus)
  should be extracted as pure functions and unit-tested, mirroring the existing
  `lib/revenuecat` + SubscriptionContext patterns.
- Purchase UI states (loading/success/disabled) verified on-device via the local debug
  build + Metro reload workflow (no EAS credits).
