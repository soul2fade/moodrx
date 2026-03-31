# MoodRx

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

## Deployment

Configured as static deployment:
- Build: `npx expo export --platform web`
- Output: `dist/` directory
