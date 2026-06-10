# MoodRx — Store Submission Checklist

**Date:** 2026-06-08
**Goal:** Everything between "code complete" and "submitted for review" on both stores, in order.

**App facts that drive this list (already true in the repo):**
- Bundle / package id: **`com.moodrx.app`** (both platforms). Apple Team **`ST6C3ZM5C3`**.
- **No accounts / no login** — all data is on-device (AsyncStorage). → No reviewer demo account needed; in-app data deletion already exists (`lib/reset-app.ts`).
- **Subscriptions via RevenueCat** (`react-native-purchases`) → IAP products must be created in *both* stores and linked to RevenueCat.
- **Health data:** iOS HealthKit (`expo-healthkit`) + Android Health Connect (`READ_STEPS/READ_SLEEP/READ_EXERCISE/WRITE_EXERCISE`). → Both stores have **extra health declarations** (see Landmines).
- **Mental-health content** incl. a crisis screen → sensitive category; expect closer review.
- Builds are produced by **EAS** (no Mac / no local Android SDK).

> Legend: ☐ = do it · ⚠️ = common rejection / easy to miss · 🔎 = verify for your specific account.

---

## 0. Prerequisites (do once)

- ☐ Apple Developer Program membership active (have it).
- ✅ Google Play Developer account active **with production-track access already granted** — the 12-tester / 14-day closed-testing gate does **not** apply to this account. (Longest remaining Android pole is now the Health Connect review — see L2.)
- ☐ **Privacy Policy** hosted at a stable public URL. Must cover: mood check-ins, health data (steps/sleep/exercise), on-device storage, no account, subscription billing, and how to delete data. *Required by both stores; health data makes it mandatory.*
- ☐ **Terms of Use / EULA** hosted at a stable URL (Apple requires this for auto-renewing subscriptions — see L1).
- ☐ **Support URL** (a simple contact/support page or email-backed page).
- ☐ Decide pricing for the subscription tier(s) and any free trial / intro offer.

---

## 1. Shared assets to prepare once (reused on both stores)

- ☐ **Screenshots** — capture on real devices/simulators. **Include the new home-screen widget** (small + medium) and a couple of core flows (mood pick, today's Rx, insights). Sizes:
  - iPhone 6.9" (or 6.7") — required.
  - iPhone 6.5" — required if not auto-scaled.
  - iPad 13" (12.9") — **required because `supportsTablet: true`**.
  - Android phone — ≥2, 16:9 or 9:16.
  - Android tablet — recommended (you support tablets).
- ☐ **App icon** — iOS uses the bundled icon; Play needs a **512×512** PNG separately.
- ☐ **Play feature graphic** — **1024×500** PNG (Play-only, required).
- ☐ Listing copy: app **name/subtitle**, **short description** (Play, ≤80 chars), **full description** (≤4000), **keywords** (App Store, ≤100 chars), **promo text** (App Store, optional).
- ☐ (Optional) App preview video.

---

## 2. iOS — App Store Connect (in order)

1. ☐ **Create the app record** (App Store Connect → Apps → +): platform iOS, name, primary language, bundle id `com.moodrx.app`, SKU.
2. ☐ **Production build:** `eas build --profile production --platform ios` then `eas submit --profile production --platform ios` (set up the **App Store Connect API key** when prompted — also used by RevenueCat). Wait for it to appear under the app's TestFlight/Build list.
3. ☐ **Subscriptions (IAP):** App Store Connect → your app → **Subscriptions**. Create the subscription group + product(s) with localized name/description, price, and a **review screenshot** of the paywall. ⚠️ First-time IAP must be **submitted *with* the app build** (attach the IAP to the version), or the version review won't include it.
   - ☐ In **RevenueCat**: add the App Store app, paste the App Store Connect API key + the **app-specific shared secret**, map the product ids to your offerings/entitlements.
4. ☐ **App Privacy** ("nutrition labels"): declare data types. Likely: **Health & Fitness**, **Sensitive Info** (mental health), **Purchases**. Do **not** declare "Usage Data / Diagnostics" — no third-party analytics/crash SDK is bundled (CatDoes Watch was removed), so no diagnostics leave the device. For each declared type: linked to identity? (**No** — no accounts) and used for **tracking**? (**No**, assuming no ad SDK). ⚠️ Must match reality and the privacy policy.
5. ☐ **Age Rating** questionnaire. Mental-health/medical references typically land **17+** — answer honestly (infrequent/mild medical or mature themes).
6. ☐ **App Review Information:**
   - No demo account needed → note: *"No login; all data is local."*
   - ☐ **Reviewer notes** explaining: HealthKit usage (steps/sleep/exercise → mood trends; not used for ads), how to reach the **premium paywall**, and that the app includes **mental-health/crisis resources** (informational, not medical advice).
   - Contact name/phone/email.
7. ☐ **Version metadata:** description, keywords, support URL, marketing URL (optional), **privacy policy URL**.
8. ☐ ⚠️ **Subscription legal links in the app metadata + binary:** the App Store description (and the in-app paywall) must link to **Terms of Use (EULA)** and **Privacy Policy**, and state subscription length/price/auto-renew. Missing EULA link is a top subscription rejection (see L1).
9. ☐ **Export compliance:** already handled (`ITSAppUsesNonExemptEncryption: false`) — confirm no prompt blocks you.
10. ☐ **IDFA / advertising:** answer **No** (no ad SDK) unless you add tracking.
11. ☐ Pricing & availability (territories), then **Add build → Submit for Review**.

---

## 3. Android — Google Play Console (in order)

1. ☐ **Create the app** (Play Console → Create app): name, default language, **App**, **Free/Paid**, declarations.
2. ☐ **Production build (AAB):** `eas build --profile production --platform android` then `eas submit --profile production --platform android` (needs a **Google Play service-account JSON** key with release permissions — set up once). EAS uploads to the chosen track.
3. ☐ **Store listing:** title, short + full description, **512 icon**, **1024×500 feature graphic**, screenshots (incl. widget + tablet).
4. ☐ **Content rating** (IARC questionnaire) — answer for mental-health themes.
5. ☐ **Target audience & content** (age groups).
6. ☐ ⚠️ **App access / Sign in details:** the app has no login, BUT **Pro is paywalled**, so do **not** select "All functionality available without special access". Instead choose **"All or some functionality is restricted"** and provide reviewer instructions containing a **Google Play subscription promo code** that unlocks Pro (the only way reviewers can reach paid content — see item 12). ⚠️ The promo code can only be generated **after** the subscription products exist (item 12), so this field currently holds a placeholder `[PROMO CODE — to be added]` that **MUST be replaced with the real code before submitting** or the app may be rejected.
7. ☐ ⚠️ **Data safety form** (App content → Data safety): declare data collected/shared, that it's stored on-device, **not shared**, encrypted in transit if any network calls, and that the user **can request deletion** (your in-app reset). Must match the privacy policy. Health data = sensitive. Crash/diagnostics: no third-party analytics/crash SDK is bundled (CatDoes Watch was removed), so no diagnostics leave the device — do **not** declare 'Diagnostics' in the Data Safety form. (OS-level crash reporting via Play Vitals needs no Data Safety declaration.)
8. ☐ ⚠️ **Health Connect declaration — LEAD ANDROID ITEM** (App content → Health apps / sensitive permissions): you request `READ_STEPS/READ_SLEEP/WRITE_EXERCISE` (the unused `READ_EXERCISE` was removed from `app.json`). Complete the Health Connect/health-permissions form, justify each permission, link the privacy policy, and 🔎 be ready for a **demo video** of the health features (see L2). With closed-testing no longer a gate, this review is now the longest pole on Android — start it first. Ready-to-paste justifications: see `docs/play-health-and-data-safety.md`.
9. ☐ **Privacy policy URL** (App content).
10. ☐ **Ads declaration:** "No ads" (assuming none).
11. ☐ **Government/health declarations** if prompted (it's a wellness app, not a regulated medical device — answer accordingly).
12. ☐ **Subscriptions (IAP):** Monetize → **Subscriptions** → create product(s) with base plans/offers, matching the ids RevenueCat expects (`moodrx_pro_monthly` $5.99 / `moodrx_pro_yearly` $44.99).
   - ☐ In **RevenueCat**: add the Play app, upload the **service-account JSON**, map product ids to offerings/entitlements.
   - ☐ ⚠️ **Generate a subscription promo code** (Monetize → Promo codes / the subscription's promotions) that unlocks Pro, then **paste it into App access → Sign in details**, replacing the `[PROMO CODE — to be added]` placeholder (item 6). Reviewer-blocking — must be done before submission.
13. ☐ Pricing & **countries/regions**.
14. ✅ **Closed testing — not required.** This account already has production-track access (L4 resolved); go straight to a production release.
15. ☐ Create a **Production release**, attach the build, add release notes, **review & roll out** (start at a staged % if you like).

---

## 4. App-specific landmines (the things most likely to bounce)

- **L1 — Apple subscription legal text (⚠️ high-risk):** auto-renewable subs require, *in the app's paywall and in the App Store description*, links to **Privacy Policy** and **Terms (EULA)** plus a clear price/period/auto-renew disclosure. Verify the in-app paywall (`lib/revenuecat.tsx` / premium screen) shows these before submitting.
- **L2 — Health permissions justification (both):** Apple checks HealthKit usage strings (present in `app.json`) and that health data isn't monetized/advertised; Google's Health Connect review may want a **screen-recording** showing exactly how each health permission is used. Have a 30–60s demo ready.
- **L3 — Privacy/Data-Safety accuracy:** the App Store privacy labels and Play Data Safety form must agree with each other **and** with the privacy policy. Mismatches are a frequent, avoidable rejection. Since data is on-device with no account, keep it honest and minimal.
- **L4 — Play closed-testing gate: ✅ N/A for this account.** Production-track access is already granted, so the 12-tester / 14-day requirement does not apply. The longest Android pole is now the **Health Connect review (L2)** — start that form first.
- **L5 — Mental-health content:** include a visible disclaimer that MoodRx is **not medical advice** and surface crisis resources (you already have a crisis screen). Reviewers look for this in wellness/mental-health apps.
- **L6 — Production build ≠ TestFlight build:** you've only run `development`/TestFlight on iOS. Smoke-test a **production** build of each platform once (paywall purchase in sandbox, health prompts, widget) before submitting.

---

## 5. Final submit sequence (once the above is filled in)

1. ☐ Privacy policy + EULA URLs live.
2. ☐ ⚠️ **BLOCKER — Play reviewer promo code:** App content → *Sign in details* declares **Yes** (Pro is a paid access tier). The reviewer instructions contain a placeholder `[PROMO CODE — to be added]`. Before submitting: create the subscriptions (Monetize → Subscriptions), generate a **one-time-use subscription promo code** (Monetize → Promotions), self-test that redeeming it unlocks Pro via RevenueCat on a production build, then paste the real code into Sign in details. Do **not** submit with the placeholder — reviewers have no login and cannot otherwise reach paid content → likely rejection.
3. ☐ iOS: production build uploaded · IAP attached · privacy/age/review-notes done · **Submit for Review**.
4. ☐ Android: production AAB uploaded · Data Safety + Health declaration + content rating done · **Sign in details promo code pasted (item 2)** · **Roll out to Production**.
4. ☐ Pitch each store's editorial team (App Store: *Featuring nomination* form; Play: *Editorial* via your Play contact) — highlight the widget + themed icon + platform integration, per the featuring roadmap.

---

*Companion to `docs/featuring-roadmap.md`. The roadmap is "what to build for featuring"; this is "how to actually ship v1."*
