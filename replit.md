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

## Environment Variables

- `EXPO_PUBLIC_CATDOES_WATCH_KEY` — Error tracking API key (in `.env`)

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
