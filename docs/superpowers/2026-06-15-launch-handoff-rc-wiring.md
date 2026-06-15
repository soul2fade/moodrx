# Launch handoff — RevenueCat wiring + remaining store submission

> Picked up in a fresh session. Read the memories listed at the bottom first.
> Repo: `C:\Users\zimme\Projects\moodrx`. Branch: `feat/pricing-clarity` (the onboarding redesign + taste-the-roast; built, reviewed "ready to merge", NOT yet merged, NOT yet on-device-verified).

## Immediate task: wire the new MoodRx+ subscriptions into RevenueCat (PRODUCTION)

The two MoodRx+ subscription products were just created in **App Store Connect** and **Google Play**. They currently exist in RevenueCat **only for the Test Store** (seeded earlier this session). The **production** App Store + Play products must now be created in RC and attached to entitlements + the `plus` offering.

### Products created in the stores (production)

**App Store Connect** — subscription group "MoodRx Pro Monthly" (group display name set to "MoodRx+"):
- `moodrx_plus_monthly` — $3.99/mo, 7-day free trial (Introductory Offer: Free / 1 week, "Never had any subscription"), 18+. Apple ID `6780575571`.
- `moodrx_plus_annual` — $24.99/yr, 7-day free trial, 18+.

**Google Play** — subscriptions:
- `moodrx_plus_monthly` — base plan `monthly`, $3.99/mo, trial offer `free-trial` (Free / 1 week, "Never had any subscription") → **Play store identifier `moodrx_plus_monthly:monthly`**.
- `moodrx_plus_annual` — base plan `annual`, $24.99/yr, trial offer `free-trial` → **`moodrx_plus_annual:annual`**.

**Already wired — DO NOT touch:** the base unlock `moodrx_pro_lifetime` ($9.99 one-time) → `premium` entitlement + `$rc_lifetime` package in the `default` (current) offering, for both app_store + play_store.

### RC wiring goal

1. **Create RC products** for the 4 production SKUs:
   - app_store (app id `appa97ed33ec8`): store_identifier `moodrx_plus_monthly`, `moodrx_plus_annual` (type `subscription`).
   - play_store (app id `appb072c40d0f`): store_identifier `moodrx_plus_monthly:monthly`, `moodrx_plus_annual:annual` (type `subscription`).
2. **Attach all 4 to BOTH the `all_access` AND the `premium` entitlement.**
   - WHY `premium` too: the live coach (`netlify/functions/coach-line.ts` → `isEntitled()`) checks the **`premium`** entitlement via RC's v1 REST API. A MoodRx+ subscriber must satisfy that or the live coach silently falls back to a static line. (This was the "live-coach fix" decided + applied this session; the coach success path was verified headlessly.)
3. **Attach to the `plus` offering's packages:** the two monthly products → the **`$rc_monthly`** package; the two annual products → the **`$rc_annual`** package. (The app reads `offerings.all['plus'].availablePackages` for `$rc_monthly`/`$rc_annual` in `purchasePlus()`.)

### RC project facts
- Project: **MoodRx** (id `projead2b038`).
- Apps: app_store `appa97ed33ec8`, play_store `appb072c40d0f`, test_store `appcf1de2875e`.
- Entitlements that exist: `premium`, `all_access`, `pack_voice_pack`, `voice_deadpan/grampa/ruthie/ed`.
- Offerings: `default` (current; `$rc_lifetime`→base), `packs` (voices — now dormant/unused after à la carte removal), `plus` (`$rc_monthly` + `$rc_annual`; the packages currently point at **test-store** products only — production needs adding).

### Tools / how to run
- Secret key already in `.env` as `REVENUECAT_V2_SECRET_KEY` (`sk_`), with project_configuration read+write.
- Working dir `C:\Users\zimme\Projects\moodrx`. Run scripts with `npx tsx scripts/<file>.ts`.
- `scripts/rcSecretClient.ts` — `sk_`-key v2 client (no Replit; the repo's `revenueCatClient.ts` uses a Replit connector that does NOT work here).
- `scripts/inspectRevenueCat.ts` — read-only catalog audit. **Run it first** to see current state, and again after wiring to confirm green.
- `scripts/seedRevenueCatTestCatalog.ts` — created the Test-Store catalog this session; **mirror its patterns** (`createProduct`, `attachProductsToEntitlement`, `attachProductsToPackage`, the `@replit/revenuecat-sdk` v2 calls) for the production app_store/play_store products. Note for subs it sets `type:'subscription'` + `subscription.duration` (`P1M`/`P1Y`).
- `scripts/verifyCoachLine.ts` — headless coach success-path check (needs `customer_information:customers:read_write` on the key, which was added earlier).

### Suggested approach
Write `scripts/seedRevenueCatProductionSubs.ts` (idempotent, mirroring `seedRevenueCatTestCatalog.ts`): resolve project + app_store/play_store apps + the `plus` offering + its `$rc_monthly`/`$rc_annual` packages + the `premium`/`all_access` entitlements; create the 4 production products; attach each to both entitlements; attach to the correct package. Then run `inspectRevenueCat.ts` and confirm every expected product shows under `premium`, `all_access`, and the `plus` packages. (Play store ids use the `productId:basePlanId` format; RC validates against the now-existing store products.)

## After RC wiring — remaining launch sequence

1. **On-device verify** the onboarding redesign + taste-the-roast (`feat/pricing-clarity`) — JS-only, `npx expo start --clear` + reload, **NO EAS**. Reset to onboarding via Settings → **Delete all data** (`resetAllAppData` → `/onboarding`). Checklists are in the two specs under `docs/superpowers/specs/2026-06-15-*`.
2. **Merge `feat/pricing-clarity` → `main`** (after verify). It contains: the pricing-clarity redesign (3-tier onboarding, voices folded into MoodRx+, à la carte removed), the taste-the-roast tile, the `reset-app.ts` logOut-on-anonymous guard, and the PlusSheet savings tag.
3. **One EAS production build per platform** (iOS + Android) — batch the work; credits are limited (see `eas-build-cost-caution`).
4. **iOS:** upload build → new App Store version → attach `moodrx_plus_monthly` + `moodrx_plus_annual` (the FIRST subscription submission must go *with* an app version) → submit to App Review. **Android:** release the subs with the production release.
5. **Age rating:** Apple — update the content questionnaire for profanity (the "Roasted" tier) → likely **17+** (currently 9+). Google — redo the IARC questionnaire for profanity. (Per-product **18+** is already set on the Play subs.)
6. **Privacy / Data Safety / reviewer promo code / EU-27 exclusion** — the user reports these were completed in a prior conversation; re-confirm nothing regressed (the taste feature adds **no** new data transmission — local clips only).

## Read these memories first
`pricing-clarity-redesign`, `ai-coach-feature`, `moodrx-plus-trial-scope`, `eas-build-cost-caution`, `local-build-verification`, `ios-app-store-state`, `android-launch-state`, `store-privacy-declarations`, `eu-distribution-deferred`, `play-reviewer-promo-code`.
