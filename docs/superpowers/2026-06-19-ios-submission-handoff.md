# iOS App Store Connect — Submission Handoff (1.0.0 / build 43)

**Why this doc exists:** App Store Connect (`appstoreconnect.apple.com`) cannot be driven by the
assistant's browser-automation tool (Apple account/financial domains are blocked), and the IAP
review screenshot must be captured from the running app on a device. So the iOS submission is
**manual**. Every field value you need is below — follow it top to bottom.

**State at handoff (2026-06-19):**
- ⚠️ **Submit BUILD 44, not 43.** Build 43 (iPad-enabled) had an overflowing iPad portrait paywall.
  Commit `d34b67a` set `supportsTablet:false` → rebuild as **build 44** (iPhone-only, auto-incremented).
  Every "build 43" reference below means **build 44**. Build cmd: `rm -rf android ios && eas build
  --platform ios --profile production`, then `eas submit --platform ios`.
- Build **43** (EAS id `b502d217`, includes the `NSPhotoLibraryUsageDescription` fix) was uploaded
  to ASC via `eas submit` — now superseded by 44.
- ASC config already DONE (do **not** redo): Paid Apps Agreement active; IAP `moodrx_pro_lifetime`
  ($9.99 non-consumable) + 2 MoodRx+ subscriptions created with metadata + availability (EU-27
  excluded); App Privacy already declares Health / Fitness / Purchases; Age rating 13+; app priced
  Free; review-notes contact info filled. See memory `ios-app-store-state`.
- **Android equivalent was submitted for review 2026-06-19** (managed publishing ON → awaiting
  manual publish). Coordinate the iOS "Submit" with the Android publish if you want a joint launch.

---

## Prerequisites (do these first — they gate submission)

### A. Store-listing screenshots (REQUIRED before you can submit)

**As of build 44 the app is iPhone-only** (`supportsTablet: false`, commit `d34b67a`) — the iPad
portrait layout overflowed, so we dropped iPad support rather than fix/ship a broken iPad UI. So you
need **one** set only (App Store Connect → MoodRx → 1.0 → App Screenshots → **iPhone** tab):
- **iPhone 6.5"** — 1242×2688 px (portrait); 1284×2778 also accepted. Apple auto-scales to smaller
  iPhones. 1–10 images. (This is the slot ASC shows.)
- **No iPad set** — iPhone-only.

Capture from **build 44** on an iPhone or the iOS Simulator. These are DIFFERENT from the IAP review
screenshot below.

### B. Capture the IAP review screenshot

Apple requires, for each in-app purchase being submitted for the first time, a screenshot showing the
purchase in the app.

1. Install build 43 on the iPad via **TestFlight** (preview/ad-hoc builds won't install — see memory
   `ios-testing-workflow`).
2. Open the app → trigger the **PlusSheet paywall** (the screen showing the MoodRx+ / Own-It tiers).
3. Screenshot it. AirDrop/save the PNG to the Mac/PC you'll use for ASC.
   - One screenshot of the paywall is enough; you'll attach the same image to all three products.

Without this image, the IAP + subscriptions stay **"Missing Metadata"** and can't be submitted.

---

## Step 1 — Select build 43 for the version

App Store Connect → **My Apps → MoodRx → (iOS) 1.0.0 Prepare for Submission** → **Build** section →
**＋ → choose build 43**.

- If build 43 isn't selectable, it's still in Apple **processing** (can take 15 min–a few hours after
  upload, sometimes longer). Wait and refresh. If it shows an error (e.g. export-compliance /
  encryption question), answer it — MoodRx uses only standard HTTPS, so "uses encryption = exempt".

## Step 2 — App Privacy: add the vent-audio data type

App Store Connect → MoodRx → **App Privacy → Edit** → **＋ Add Data Type** → **Audio Data**, then:

| Question | Answer |
|---|---|
| Is this data used to track you? | **No** |
| Is this data linked to the user's identity? | **No** |
| What is this data used for? | **App Functionality** (only) |

This is the same pattern as the existing Health / Fitness / Purchases entries. It covers the
voice-vent flow: on cloud fallback the audio goes to Apple/Google's speech recognizer, and the
transcript goes to our AI provider (Anthropic). Apple's self-reported label covers the third-party
partner — no separate Anthropic entry is needed. (Source: memory `store-privacy-declarations`.)

Save / Publish the App Privacy change.

## Step 3 — Attach the review screenshot to each IAP

For **each** of these three products (App Store Connect → MoodRx → either the **In-App Purchases** or
**Subscriptions** tab):
- `moodrx_pro_lifetime` ("MoodRx Pro" / Own It, $9.99 non-consumable)
- MoodRx+ **Monthly** subscription
- MoodRx+ **Annual** subscription

…open the product → **App Store Information / Review Information → Screenshot** → upload the paywall
PNG from the prerequisite. Fill any remaining required review notes field with: *"Screenshot shows the
in-app paywall where this purchase is offered."*

Each product should flip from **"Missing Metadata"** to **"Ready to Submit"** once the screenshot +
metadata are set.

## Step 4 — Attach the IAPs/subscriptions to the 1.0.0 version

On the **1.0.0 Prepare for Submission** page → **In-App Purchases and Subscriptions** section →
**＋** → add `moodrx_pro_lifetime` + both MoodRx+ subscriptions.

> First-time IAP/subscription review **must ride with an app version + build** — that's why they're
> attached here rather than submitted standalone.

## Step 5 — App Review notes (paste this verbatim)

On the 1.0.0 version page → **App Review Information → Notes**:

```
No login or accounts — all data is stored on-device. Paid features unlock via in-app
purchase (testable in the sandbox).

• "Own It" (all workouts, full history, supplement tracker, AI coach): one-time IAP on the paywall.
• Coach voices require MoodRx+ (subscription) — subscribe on the paywall, or use the in-app
  7-day free trial: Settings → Coach voice → MoodRx+.
• AI Coach is opt-in and off by default (Settings).
• Voice Venting: tap the mic and speak; speech is transcribed on-device when possible, otherwise
  by Apple/Google, and the transcript is sent to our AI provider (Anthropic) for a reply —
  audio/transcript are not stored or used to train AI.

No 2FA or extra steps.
```

(Apple reviewers test IAPs in the **sandbox**, so no promo codes are needed here — unlike the Android
reviewer note.)

## Step 6 — Submit for Review

Version page → **Add for Review / Submit for Review** → confirm. This submits the app + the three
IAP/subscription products together.

> ⚠️ **This is the iOS launch action.** If you want iOS + Android to go live together, hold this until
> you're ready to also press **Publish** on the approved Android release (Play Console → Publishing
> overview → Changes ready to publish).

---

## After submission — verify on device (sandbox)

Per memory `ios-testing-workflow` (TestFlight on the iPad), sanity-check before/while in review:
- IAP **purchase + restore** for Own It works and unlocks the gated content (RevenueCat `all_access`).
- A MoodRx+ **subscription / 7-day trial** unlocks the coach **voices**.
- AI Coach success path (opt in via Settings → a post-workout coaching line appears).
- Voice Venting: mic → transcript → Dr. MoodRx reply (falls back to the mood form offline).

## Known residual risks / notes
- **Promo-code redeem path untested:** the Android reviewer-code promotion shows 0/10 redeemed, i.e.
  no one has actually redeemed a lifetime code to confirm it unlocks Pro via RevenueCat. The billing
  path is the same one verified with a license-tester purchase, so it should work — but a redeem-test
  would remove all doubt. (iOS uses sandbox, so this only affects the Android reviewer flow.)
- **"Data Linked to You = No"** for Audio Data is medium-confidence (no name/account id is sent). If
  Apple's reviewer pushes back on sensitive free-form content, switching it to "Linked" is the safe
  fallback. (Source: `store-privacy-declarations`.)
- Age rating is already **13+** (Frequent profanity from the "Roasted" tier); applies with this
  version. Don't chase 17+.
