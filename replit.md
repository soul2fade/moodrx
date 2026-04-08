# MoodRx

> **BEFORE DOING ANY IOS BUILD WORK** — read the "iOS Build → TestFlight" section below first.
> The working process is fully documented. Do not guess, do not regenerate credentials, do not change the p12 format.
> Cert files live in `.local/ios-cert/` — see `.local/ios-cert/README.md` for everything.

A mobile-first wellness app built with Expo (React Native) that focuses on mood tracking, workouts, and mental wellness.

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router (file-based routing)
- **UI**: NativeWind (TailwindCSS for React Native) + Gluestack UI
- **State**: React Query (@tanstack/react-query) + React Context
- **Backend/DB**: Supabase (@supabase/supabase-js)
- **Payments**: react-native-purchases (RevenueCat)
- **Font**: Space Grotesk (@expo-google-fonts/space-grotesk)
- **Animations**: react-native-reanimated, @legendapp/motion
- **Monitoring**: @catdoes/watch (error tracking)

## Project Structure

```
app/               # Expo Router pages (file-based routing)
  _layout.tsx      # Root layout with providers
  index.tsx        # Splash/routing screen
  home.tsx         # Home/dashboard
  onboarding.tsx   # First-launch onboarding
  insights.tsx     # Analytics/insights
  workout.tsx      # Workout screen
  settings.tsx     # Settings
  premium.tsx      # Premium paywall
  ...
components/        # Shared React Native components
  ui/              # Gluestack UI primitive wrappers
contexts/          # React Context providers
  SubscriptionContext.tsx
hooks/             # Custom React hooks
lib/               # Utility libraries (storage, moods, workouts, etc.)
utils/             # General utilities
assets/            # Images, icons, fonts
```

## Development

The app runs on port 5000 via the Expo web bundler (Metro).

**Workflow**: `Start application` — runs `PORT=5000 npx expo start --web --port 5000`

## RevenueCat (COMPLETE)

RevenueCat is fully integrated for real in-app purchases.

**Project:** `projead2b038` (MoodRx)
**Entitlement:** `premium`
**Offering:** `default` (current)
**Packages:** `$rc_monthly` ($6.99/mo), `$rc_annual` ($49.99/yr)

**Key files:**
- `lib/revenuecat.tsx` — initialization logic (`initializeRevenueCat`)
- `contexts/SubscriptionContext.tsx` — RC purchases + 7-day local trial
- `scripts/revenueCatClient.ts` — server-side RC API client (uses Replit connectors)
- `scripts/seedRevenueCat.ts` — seed script (run once to set up RC entities)

**Key flows:**
- `initializeRevenueCat()` called top-level in `app/_layout.tsx`
- `isPremium` derived from RC `CustomerInfo` entitlement (`premium`)
- 7-day free trial logic (AsyncStorage) preserved alongside RC
- In `__DEV__` mode, purchases show a confirmation modal before executing
- `app/premium.tsx` reads prices from RC offerings (no hardcoded strings)

**To re-seed RevenueCat:** `npx tsx scripts/seedRevenueCat.ts`

## Environment Variables

- `EXPO_PUBLIC_CATDOES_WATCH_KEY` — Error tracking API key (in `.env`)
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` — RC test store public key
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — RC App Store public key
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` — RC Play Store public key
- `REVENUECAT_PROJECT_ID` — RC project ID
- `REVENUECAT_TEST_STORE_APP_ID`, `REVENUECAT_APPLE_APP_STORE_APP_ID`, `REVENUECAT_GOOGLE_PLAY_STORE_APP_ID` — RC app IDs

## Installed Packages (beyond package.json originals)

The following packages were not in the original `package.json` but were required:
- `@expo-google-fonts/space-grotesk` — font used in `_layout.tsx`
- `@react-native-community/slider` — slider UI component
- `react-native-view-shot` — screenshot/share from insights screen
- `expo-sharing` — native share sheet for insights

## iOS Build → TestFlight (WORKING PROCESS)

**Full end-to-end process that works as of April 6, 2026.**

### One-time setup (already done — do not redo)
- **Apple Distribution Certificate**: Generated via OpenSSL CSR, signed by Apple, converted to `.p12` with **legacy 3DES encryption** (`openssl pkcs12 -export -legacy`). Key insight: OpenSSL 3.x uses AES-256 by default which macOS keychain rejects — must use `-legacy` flag.
- **Certificate files**: `.local/ios-cert/distribution.key`, `.local/ios-cert/distribution_legacy.p12` (password: `MoodRx2026`), `.local/ios-cert/chain.pem` (cert + Apple WWDR G3 intermediate)
- **EAS credentials** (stored in EAS cloud):
  - App credentials ID: `a0d5f707`
  - Distribution cert ID: `45e38347` (serial: `45F57738150F2526813F66A57A9B53EA`, valid until Apr 2027)
  - Provisioning profile ID: `9f748fb2` (App Store type, bundle: `com.moodrx.app`, valid until Apr 2027)
  - APP_STORE build credentials ID: `1d89f696`
- **Apple Team**: `ST6C3ZM5C3` (Daniel Zimmer Individual)
- **Bundle ID**: `com.moodrx.app`
- **EAS project ID**: `856c4912-709e-4132-9028-49d55e06e6b5`
- **GitHub secrets required**: `EXPO_TOKEN`, `GITHUB_TOKEN`, `ASC_APP_ID` (numeric Apple ID from App Store Connect → App Information)

### To trigger a new iOS production build + TestFlight upload
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/soul2fade/moodrx/actions/workflows/eas-build.yml/dispatches \
  -d '{"ref":"main","inputs":{"platform":"ios","profile":"production"}}'
```
Or go to **github.com/soul2fade/moodrx/actions → EAS Build → Run workflow → ios / production**.

### How it works
1. GitHub Actions runs `.github/workflows/eas-build.yml`
2. `eas build --platform ios --profile production --non-interactive --wait` — EAS pulls credentials from cloud, builds on Apple's Mac servers (~15 min)
3. Submit step patches `eas.json` with `ASC_APP_ID` secret at runtime, then runs `eas submit --platform ios --latest --non-interactive`
4. Apple processes the build (~10–30 min), then it appears in TestFlight

### If credentials need to be re-uploaded to EAS
```bash
# Upload the cert (must use -legacy flag for macOS keychain compatibility)
P12_BASE64=$(base64 -w 0 .local/ios-cert/distribution_legacy.p12)
# POST to EAS GraphQL: createAppleDistributionCertificate with certP12=$P12_BASE64, certPassword="MoodRx2026"
# Then link to APP_STORE build credentials via setDistributionCertificate
```

## Deployment

Configured as static deployment:
- Build: `npx expo export --platform web`
- Output: `dist/` directory
