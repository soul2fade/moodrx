# Voiced Insult Commerce (Phase 3) — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pre-plan.
**Sub-project 3 of 3** in the "voiced trash-talk app-side wiring" build:
1. **Delivery (done)** — host the library + fetch/cache playback.
2. **Control (done)** — the severity sheet (audio tier + coach tone).
3. **Commerce (this spec)** — the Settings voice picker + a single "Unlock all voices" IAP bundle, with per-voice previews.

## Context

Phases 1–2 left the workout playing a **fixed `rachel`** voice (the free default) at the user-chosen severity. The 960-clip library has 5 voices (rachel free; deadpan / grampa / ruthie / ed). RevenueCat plumbing already exists: `ownsPack(packId)` / `purchasePack(packId)` against the `packs` offering, `packEntitlementId(packId)` → entitlement, a purchase-confirm dialog, restore, and a `__DEV__` mock-grant path (test without the store). Constants live in `lib/revenuecat.ts`; Settings already has a Restore button. Phase 3 lets the user pick a voice and sells the 4 paid voices as **one bundle**.

## Goals

- A Settings **voice picker** where the user selects their coach voice; Rachel is free, the other 4 are gated behind a single bundle.
- **One IAP** ("Unlock all voices") that grants all 4 paid voices — simplest UX, no nickel-and-diming (protects the mental-health-app brand).
- **Per-voice previews** (including locked voices) — endowment-effect conversion lift; works because the static-hosted clips are directly fetchable.
- The chosen voice drives workout playback; safe fallback to Rachel on any ownership/availability gap.
- Reuse the existing RevenueCat plumbing + the `__DEV__` mock-grant so it's testable without store products.

## Non-goals

- Per-voice à-la-carte IAPs or a decoy bundle structure (single bundle only for v1).
- Gating the bundle behind the $9.99 base unlock — the voice bundle is **standalone** (anyone can buy it).
- The live Pro-gated post-workout roast (separate piece).
- Server-side entitlement gating of paid-voice audio (static URLs are public by design; the value is the curated experience, and previews depend on that openness).

## Design

### Component 1 — Voice registry + selection (`lib/voices.ts`, new, pure)
- `VOICES: { name: string; label: string; free: boolean }[]` — the 5 voices (rachel free; deadpan/grampa/ruthie/ed paid), in display order. `name` matches the manifest voice keys + the audio folder names. Static so the picker renders even before the library is hosted (the manifest is only needed for playback/preview).
- `isVoiceName(v): boolean` / `normalizeVoice(raw, fallback='rachel')` — coerce a stored value to a known voice.
- `effectiveVoice(selected: string, ownsBundle: boolean): string` — **pure**: a free voice → itself; a paid voice when `ownsBundle` → itself; otherwise → `'rachel'`. This is what actually plays (covers refunds, unknown values, not-yet-purchased).
- `VOICE_PACK_ID = 'voice_pack'` lives in `lib/revenuecat.ts` (the bundle's pack id; `ownsPack(VOICE_PACK_ID)` = owns all paid voices).

### Component 2 — Persist the selected voice (`lib/storage.ts`)
- `getCoachVoice(): Promise<string>` / `setCoachVoice(name: string)`, key `@moodrx_coach_voice`, default `'rachel'`, unknown→`'rachel'` via `normalizeVoice`. Also cleared by `clearAllData` (matching the convention).

### Component 3 — The voice picker (`components/VoiceSheet.tsx`, new)
- A modal (same pattern as `SeveritySheet`) opened from a new Settings **"Coach voice"** row (shows the current voice's label). Lists the 5 `VOICES` rows; each row: label, a **play-sample** button, and a state — **selected** (✓), **owned → tap to select**, or **locked** (the 4 paid when the bundle isn't owned).
- A single **"Unlock all voices — <localized price>"** CTA below the list (shown only when the bundle isn't owned). Tapping it calls `purchasePack(VOICE_PACK_ID)`; on success the 4 unlock and become selectable. Price comes from the `packs` offering's package (`offerings.all[PACKS_OFFERING_ID]`); if unavailable, the CTA shows a generic "Unlock all voices".
- Selecting a voice calls `setCoachVoice(name)` + updates state + closes (or stays open — see open decisions). Restore reuses the existing Settings Restore button.
- Presentational w.r.t. ownership/price: it receives `ownsBundle`, the price string, `selected`, and callbacks (`onSelect`, `onPreview`, `onBuy`, `onClose`); it does not call RevenueCat directly.

### Component 4 — Preview playback
- A small hook/util `useVoicePreview()` (or inline in the picker container): on `onPreview(voiceName)`, pick one clip for that voice at the current severity (default `sticks`) from the fetched manifest (`pickClip`), `ensureClip` it, and play through a dedicated `expo-audio` player. Works for locked voices (static URLs). If the manifest isn't available (library not hosted) the preview is a no-op and the sample button is disabled.

### Component 5 — Workout wiring (`app/workout.tsx`)
- Replace the `DEFAULT_INSULT_VOICE = 'rachel'` constant with state derived from the selected voice + bundle ownership: `const voice = effectiveVoice(selectedVoice, ownsPack(VOICE_PACK_ID))`. Load `getCoachVoice()` on mount; read `ownsPack` from `useSubscription()`. The trash-talk effect uses `voice` (alongside the Phase-2 `insultSeverity`) for `prefetchTier`/`pickClip`; add `voice` to the effect deps. Bundled fallback unchanged.

### Component 6 — RevenueCat
- `VOICE_PACK_ID = 'voice_pack'` — one bundle product in the `packs` offering with its entitlement (`packEntitlementId('voice_pack')`). The app calls the existing `ownsPack`/`purchasePack`/`restorePurchases`; the `__DEV__` mock-grant path lets the full flow (lock → buy → unlock → select → play) be exercised without store products.

## Data flow
1. Settings → "Coach voice" → picker. Reads `selected = getCoachVoice()`, `ownsBundle = ownsPack(VOICE_PACK_ID)`, price from offerings.
2. Preview: tap sample → `pickClip(manifest, voice, severity)` → `ensureClip` → play.
3. Buy: tap CTA → `purchasePack(VOICE_PACK_ID)` → on grant, `ownsBundle` flips → the 4 unlock.
4. Select an owned voice → `setCoachVoice(name)`.
5. Workout: `effectiveVoice(selected, ownsBundle)` → plays `<voice> × <severity>`, bundled fallback on any miss.

## Error handling
- Stored voice unknown / paid-but-not-owned / entitlement lost → `effectiveVoice` returns `'rachel'`; the picker only lets you *select* owned/free voices.
- Library not hosted / manifest null → previews disabled; workout plays the bundled fallback (a paid selection silently degrades to bundled until hosting lands).
- Offerings/price unavailable → CTA shows generic copy; `purchasePack` no-ops gracefully if the package is missing (existing behavior).
- Purchase cancel/failure → existing RevenueCat alert/confirm flow; no state change.

## Testing
Pure-logic vitest:
- `lib/voices.ts` — `VOICES` (5 entries, rachel free + 4 paid, expected names/labels/order); `normalizeVoice` (unknown→rachel); `effectiveVoice` (free→self; paid+owned→self; paid+unowned→rachel; unknown→rachel).
- The stored-voice default/normalize (covered by `normalizeVoice`).
Picker UI, preview playback, purchase flow, and the workout wiring are verified **on-device** (the project's convention), including the `__DEV__` mock-grant lock→buy→unlock→select→play path.

## Existing code this builds on / touches
- `contexts/SubscriptionContext.tsx` — `ownsPack`/`purchasePack`/`offerings`/`restorePurchases` (unchanged; consumed).
- `lib/revenuecat.ts` — add `VOICE_PACK_ID`; `PACKS_OFFERING_ID`/`packEntitlementId` (consumed).
- `lib/storage.ts` — add `getCoachVoice`/`setCoachVoice` (mirror the Phase-2 severity accessors).
- `lib/insult-library.ts` / `lib/insult-cache.ts` (Phase 1) — `pickClip`, `ensureClip`, `fetchManifest` for previews.
- `app/workout.tsx` — `DEFAULT_INSULT_VOICE` → `effectiveVoice(...)`.
- `app/settings.tsx` — add the "Coach voice" row that opens the picker.

## Owner-ops
- Create the **`voice_pack`** bundle product in RevenueCat (`packs` offering) + both stores, attach its entitlement, set the price. (Until then, the `__DEV__` mock-grant exercises the flow.)
- Carry-over: deploy `output/` to the Netlify assets site + set `EXPO_PUBLIC_INSULTS_BASE_URL` (Phase 1) so paid voices + previews actually play.

## Open decisions — resolved
1. **Pack model:** single "Unlock all voices" bundle (not per-voice, not a decoy structure).
2. **Previews:** yes — per-voice (incl. locked) sample playback.
3. **Bundle gating:** standalone (no base-unlock requirement).
4. **Picker presentation:** a modal (matching `SeveritySheet`); selecting may close it (final polish on-device).
5. **Preview tier:** the user's current severity (default `sticks`).

## Success criteria
- Settings → "Coach voice" lists 5 voices; Rachel + any owned are selectable, the 4 paid are locked until the bundle is bought; the selected voice persists (default Rachel).
- The "Unlock all voices" IAP grants all 4; afterward they're selectable and play in the workout. The `__DEV__` mock-grant runs the whole flow without store products.
- Per-voice previews play a sample (incl. locked voices) when the library is hosted.
- Workout plays the effective voice × severity; a refund / unknown / unhosted state safely falls back to Rachel / bundled clips.
- Pure-logic unit-tested; typecheck + lint clean.

## ⚠ Launch note
Carries the **17+** rating (the Roasted tier is hard-R) and the Phase-1 hosting deploy. The `voice_pack` store product + price are new store-config items for submission.
