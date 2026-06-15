# Phase C — Voices à la carte (design spec)

**Date:** 2026-06-14
**Status:** Approved in brainstorming; ready for implementation planning.
**Parent:** [purchase-flow redesign](2026-06-14-purchase-flow-redesign-design.md) build order, Phase C.
**Goal:** Sell the four paid coach voices individually ($0.99 each) or as a bundle
($2.99 all), at the coach-voice picker — the sample→buy impulse moment.

---

## 1. Model (decided)

| Item | Price | Notes |
|---|---|---|
| Rachel | free | unchanged |
| Each paid voice (`deadpan`, `grampa`, `ruthie`, `ed`) | **$0.99** one-time | new per-voice non-consumables |
| All four voices | **$2.99** one-time | the existing `voice_pack` bundle |

Voices stay **separate from the $9.99 base** (owning the base does not grant
voices). This is intentional — confirmed that no shipping copy claims otherwise
(`CANONICAL_OFFER_LINE` "Unlock everything" is currently unused; the offer sheet
always shows a *contextual* headline, never the generic one). Revisit only at
**Phase D** if/when "Unlock everything" is surfaced on onboarding.

Out of scope: the $9.99 base, the live AI coach, and MoodRx+ (Phase E) are
untouched.

---

## 2. Products & entitlements

- Add four RevenueCat **non-consumables**: `voice_deadpan`, `voice_grampa`,
  `voice_ruthie`, `voice_ed` ($0.99 each).
- Reuse the existing **`voice_pack`** ($2.99) as the "All voices" bundle.
- All five packages live in the **existing `packs` offering** (`PACKS_OFFERING_ID`),
  so the picker reads every voice price from one offering — no new offering to
  configure.
- **Entitlement convention:** a voice product `voice_<name>` grants entitlement
  `voice_<name>`. Ownership of a voice resolves as:

  ```
  ownsVoice(name) = ownedEntitlements.has('voice_' + name)        // bought the voice
                 || ownedEntitlements.has('pack_voice_pack')       // bought the bundle (packEntitlementId('voice_pack'))
                 || ownedEntitlements.has('all_access')            // future MoodRx+ (Phase E); harmless now
  ```

  Free voices (Rachel) are always owned regardless.

---

## 3. Pure logic (TDD first) — `lib/voices.ts`

Extend the existing pure module and unit-test per parent spec §10
("owns-voice OR bundle OR plus").

- New: `voiceEntitlementId(name: string): string` → `` `voice_${name}` ``.
- New: `ownsVoice(name: string, owned: ReadonlySet<string>): boolean` — implements
  the resolution in §2 (free voice → true; else voice-entitlement OR bundle OR
  all_access). The bundle/all-access entitlement ids (`'pack_voice_pack'`,
  `'all_access'`) are **mirrored as local literals** in `lib/voices.ts` (as
  `lib/offer-copy.ts` does for `$rc_lifetime`) — they must NOT be imported from
  `lib/revenuecat.tsx`, which pulls in `react-native-purchases` and would break the
  vitest (node) environment. Add a comment naming `lib/revenuecat.tsx` as the
  source of truth.
- Refactor `effectiveVoice` to take per-voice ownership instead of a single
  `ownsBundle` flag:

  ```ts
  // before: effectiveVoice(selected, ownsBundle)
  // after:  effectiveVoice(selected, owned: ReadonlySet<string>)
  //   plays `selected` when free or ownsVoice(selected, owned); else 'rachel'.
  ```

  Update all callers of `effectiveVoice` accordingly.

Tests cover: free voice always plays; bought-voice plays; bundle owner plays any
paid voice; all_access plays any; unowned paid voice → 'rachel'; unknown →
'rachel'.

---

## 4. SubscriptionContext

- Add `purchaseVoice(name: string): Promise<boolean>` mirroring `purchasePack`:
  finds the `voice_<name>` package in the `packs` offering and calls the existing
  `triggerPurchase(pkg, voiceEntitlementId(name))`. The `__DEV__` mock-grant path
  already handles a missing package (grants the passed entitlement), so the full
  flow is testable on the local build with no real products.
- Expose `ownsVoice(name)` from context (wrapping the pure `ownsVoice` over the
  context's `ownedEntitlements` set), alongside the existing `ownsPack`.
- No change to `purchaseBase`, `restorePurchases`, or the dev confirm modal.

---

## 5. Picker UI — `components/VoiceSheet.tsx` + `components/CoachVoicePicker.tsx`

`CoachVoicePicker` owns the purchase wiring (it already holds `usePurchaseButton`
patterns from Phase A); `VoiceSheet` stays presentational and receives derived
display props per voice.

- **Per voice row:**
  - Free or owned → unchanged ("Tap to use" / "Selected" + Sample).
  - Locked → **Sample** + a **"$0.99"** buy button driven by `usePurchaseButton`
    (disabled until offerings settle, spinner → "✓"). On success the bought voice
    **auto-selects** (`onSelect(name)`), dropping the user into what they unlocked;
    the sheet stays open.
- **Bundle CTA (below rows):** **"All voices — $2.99"** via `usePurchaseButton`
  (spinner → "✓"); hidden once the bundle/all-access is owned (i.e. all paid
  voices owned).
- Prices come from the `packs` offering package `priceString`s (fallback `$0.99` /
  `$2.99`).
- **Defer** the "Included with MoodRx+ →" line to Phase E.
- Reuse the existing Sample mechanism (`previewAvailable` / `onPreview`,
  manifest-gated) unchanged.

Per-voice buy state is component-local; map each row to its own
`usePurchaseButton` controller keyed by voice name.

---

## 6. Build & verify

- **App-side is JS-only** → verifies on the local debug build + Metro reload via
  the `__DEV__` mock-grant: lock → Sample → buy ($0.99 and $2.99) → unlock →
  auto-select → play. **No EAS build** (see `local-build-verification`,
  `eas-build-cost-caution` memories).
- **Store config (separate, manual):** create the four `voice_*` $0.99
  non-consumables in **App Store Connect + Google Play + RevenueCat** and add them
  to the `packs` offering. **No app rebuild required** — offerings load at runtime.
  - **Critical naming:** in the `packs` offering, each voice's **package identifier
    must be exactly `voice_<name>`** (`voice_deadpan`, `voice_grampa`,
    `voice_ruthie`, `voice_ed`) — the app looks up packages by
    `package.identifier === voice_<name>` for both price display and purchase, the
    same convention `voice_pack` uses. If the package slot is named anything else,
    the price falls back to `$0.99`/`$2.99` and a real purchase shows "Unavailable"
    (the `__DEV__` mock-grant path does not exercise this lookup, so it can only
    surface on a store build).
- `npm test`, `npm run typecheck`, `npx expo lint` green before each commit.

---

## 7. Testing notes

- Pure entitlement logic (`ownsVoice`, `effectiveVoice`) is unit-tested (vitest),
  mirroring `lib/__tests__/voices.test.ts`.
- Purchase UI states (per-voice loading/success, bundle, disabled-until-loaded)
  verified on-device via the local debug build (mock-grant), not EAS.
