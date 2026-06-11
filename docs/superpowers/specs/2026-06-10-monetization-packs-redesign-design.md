# MoodRx Monetization Redesign — Budget Unlock + Content Packs

**Date:** 2026-06-10
**Status:** Approved design — ready for implementation planning
**Scope:** Replace the subscription monetization with a one-time **base unlock** plus an architecture for **content packs**, shipped in the single pre-launch production build (both platforms).

---

## 1. Context & problem

MoodRx currently monetizes via auto-renewing subscriptions (`$rc_monthly` $5.99 / `$rc_annual` $44.99) wired through RevenueCat (entitlement `premium`), with a 7-day free trial on the annual plan. The subscription stack is built and verified end-to-end on Android.

The content is **thin** — 18 workouts (3 each across 6 moods), seen in a weekend, with no progression or freshness mechanism. A recurring charge against thin content drives severe churn and a weak value-justification, especially anchored against Calm/Headspace-tier expectations. Analysis concluded:

- A churning subscription does not compound — at realistic retention it yields *less* per converting user than a coherently-priced one-time unlock.
- Pricing is **second-order to distribution**; the real growth lever is a short-form-video content channel (post-launch), not pricing.
- A subscription is only justified once there is **continuous** content delivery (a growing pack library). That is something to *earn* post-launch, not launch against.

**Decision:** launch with a **budget one-time base unlock** + an architecture for **à-la-carte content packs**, and defer any subscription until a pack library exists.

## 2. Goals

- Replace subscription-gated `premium` with a **one-time base unlock** that grants the same feature set.
- Introduce a **pack ownership model** (per-pack entitlements) so new content can be sold individually post-launch.
- Add a cheap perceived-depth win: **programs** (curated sequences of existing workouts), free within the base unlock.
- Keep the free tier and the free/paid boundary **unchanged** — swap only the payment *mechanism*.
- Architect entitlements so a future **all-access subscription** can be added with no rework.
- Batch all changes into the **single** production build per platform (EAS credits constrained).

## 3. Non-goals (explicitly deferred to post-launch roadmap)

- Authoring actual content packs (themed programs, guided audio in the Dr. MoodRx voice). Launch ships the pack **store scaffolding** with zero packs.
- The **all-access subscription** product. Architected-for, not implemented.
- Personalization / "what works for you" expansion (robustness lever 3).
- EU distribution (already deferred; see `eu-distribution-deferred`).
- Any change to the free/paid feature boundary.

## 4. Monetization model

| Tier | Mechanism | Grants |
|---|---|---|
| **Free** | — | Current free experience, unchanged |
| **Base unlock** | One-time non-consumable IAP | Everything `premium` unlocks today + programs |
| **Packs** | One-time non-consumable IAPs (post-launch) | Each grants its own pack entitlement |
| **All-access sub** *(future)* | Subscription | Superset: all pack entitlements while active |

## 5. Pricing

- **Base unlock:** **$9.99** one-time (conversion-optimized for an unknown brand; do not overprice thin content — overpricing tanks conversion and generates refunds/bad reviews). Adjustable in store config without code change.
- **Packs (post-launch):** $2.99–$4.99 each.
- **All-access sub (future):** ~$3.99/mo or ~$24.99/yr, anchored below the cost of buying ~3 packs individually.

These are launch recommendations; real funnel data retunes them.

## 6. Programs (the launch "depth" win)

Two curated **programs** — ordered multi-session sequences drawn from the existing 18 workouts (e.g. a cross-mood "Reset Week"). They add progression and a reason-to-return without new content.

- **Free within the base unlock** (built from content base-unlock users already own) — NOT a paid pack.
- Lightweight UI: a "Programs" entry surfacing the sequences and tracking position within them. Implementation should reuse existing workout rendering; a program is an ordered list of existing workout IDs plus title/description.

## 7. Entitlement architecture

Today gating is a single `isPremium` boolean derived from the `premium` entitlement ([contexts/SubscriptionContext.tsx](../../../contexts/SubscriptionContext.tsx)). This expands into a small **ownership model**:

- `ownsBase` = `customerInfo.entitlements.active['premium'] !== undefined` (granted by the base-unlock non-consumable).
- `ownsPack(id)` = `active['pack_' + id] !== undefined || hasAllAccess`.
- `hasAllAccess` = future subscription entitlement (always `false` at launch; the check exists so adding the sub later requires no consumer changes).

RevenueCat:
- Base unlock product → grants `premium`.
- Each pack product → grants `pack_<id>`.
- Packs surfaced via a dedicated `packs` offering (empty at launch).
- Existing subscription packages removed from the `default` offering's purchase path.

Gating consumers (`useSubscription` → renamed/refactored to an entitlements hook) read `ownsBase` where they currently read `isPremium`. Pack-gated UI reads `ownsPack(id)`.

## 8. Code impact

- **`contexts/SubscriptionContext.tsx`** → refactor to an **Entitlements** context: expose `ownsBase`, `ownsPack(id)`, `isLoading`, `offerings`, `purchaseBase()`, `purchasePack(id)`, `restorePurchases()`. Retire subscription/trial-specific logic: `startTrial`, `purchaseMonthly`, `purchaseYearly`, trial-eligibility checks, trial-day countdown, and trial-nudge scheduling (`maybeScheduleTrialNudges`, `checkTrialUsedFromRC`).
- **`lib/revenuecat.tsx`** → entitlement identifier constants extended (`premium` for base; pack entitlements namespaced `pack_*`). API-key logic unchanged.
- **`lib/subscription.ts` + trial nudges** → remove/disable trial-anchor logic and `scheduleTrialNudges` usage tied to the trial (no trial in a one-time model).
- **`components/PremiumSheet.tsx`** → replace the monthly/yearly plan-picker + trial language with a single one-time "Unlock MoodRx Pro — $9.99" CTA; keep Restore Purchases; remove "free trial / cancel anytime" copy. Keep the subscription legal-disclosure pattern only where still applicable (one-time purchases need no auto-renew disclosure).
- **New — Pack store screen** → lists packs from the `packs` offering with buy buttons; at launch renders an empty/"more coming soon" state. Scaffolding only.
- **New — Programs feature** → data (ordered workout-ID sequences + metadata) and a light UI to play through them.
- **Consumers of `isPremium`** (e.g. [app/insights.tsx](../../../app/insights.tsx), settings, supplements) → read `ownsBase`.
- Onboarding/paywall entry points that referenced the trial → updated to the one-time unlock.

## 9. Store configuration

- **iOS (App Store Connect):** create a **non-consumable** base-unlock IAP. Retire/ignore the `moodrx_pro_monthly` / `moodrx_pro_yearly` subscriptions created during this launch (delete or leave inactive — no real purchasers).
- **Android (Google Play):** create a one-time **in-app product** for the base unlock. The verified subscription stack (`moodrx_pro_monthly` / `moodrx_pro_yearly`, RevenueCat, RTDN) stays built but unused.
- **RevenueCat:** add the base-unlock products (both platforms) mapped to `premium`; create the `packs` offering for future use.

## 10. Migration / existing purchases

No real customers exist (pre-launch; only license-tester/sandbox purchases). No migration path required. Sandbox test entitlements can be ignored or reset.

## 11. Build & launch implications

- This refactor must be in the **single** production build per platform — it changes the paywall, so it cannot be a post-launch patch without another paid build.
- The build is the convergence point for the rest of launch: Health Connect demo video (Android), promo-code redeem test, iOS TestFlight smoke test, then submission.
- Reminder: exclude EU at the availability step on both stores (`eu-distribution-deferred`).

## 12. Risks

- **Refactor scope:** expanding `isPremium` → ownership model touches every gated screen. Mitigation: keep an `ownsBase` alias mapping to the old boolean semantics so most consumers change one identifier, not their logic.
- **Trial removal:** existing trial-nudge notifications/onboarding assume a trial. Must be cleanly removed to avoid scheduling dead notifications.
- **Store review:** a one-time IAP paywall is simpler for review than subscriptions (no auto-renew disclosure burden), but the reviewer promo-code flow (`play-reviewer-promo-code`) must be updated — the reviewer now needs to reach a one-time unlock, not a sub. The promo mechanism may need revisiting for a non-subscription product.

## 13. Post-launch roadmap (informs architecture, not built now)

1. Ship content packs (programs, then Dr. MoodRx audio sessions) as new content is produced — content doubles as short-form-video distribution material.
2. Introduce the all-access subscription once ~4–6 packs exist.
3. Expand personalization / the data loop.
4. Revisit EU distribution + business-account conversion.
