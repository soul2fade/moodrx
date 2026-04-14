# AGENTS.md

This file provides guidance to CatDoes (catdoes.com) when working with code in this repository.

## Project Overview

Expo (SDK 54) + React Native mobile app template using file-based routing (expo-router), NativeWind v4 for styling, and gluestack-ui v3 for the component library. Targets iOS, Android, and web. React Native New Architecture is enabled.

## Commands

- **Start dev server:** `npm start` (or `expo start`)
- **Platform-specific:** `npm run ios`, `npm run android`, `npm run web` (sets `DARK_MODE=media`)
- **Lint:** `npm run lint` (uses eslint-config-expo flat config)
- **Type check:** `npm run typecheck` (`tsc --noEmit`)
- **EAS build:** `eas build --profile development|preview|production`
- **Install packages:** `npm install --legacy-peer-deps` (enforced via `.npmrc`)

## Architecture

### Routing

File-based routing via expo-router. All routes live in `app/`. The root layout (`app/_layout.tsx`) wraps everything in `ErrorBoundary` > `GluestackInitializer` > `Stack`. Typed routes are enabled in `app.config.ts`.

### Styling Stack

Three layers work together — do not modify their wiring independently:

1. **NativeWind v4** — Tailwind CSS classes in React Native, configured in `tailwind.config.js` with `global.css` as input
2. **Tailwind with CSS variables** — Design tokens (colors) are CSS variables defined in `components/colors/light.ts` and `components/colors/dark.ts` using `nativewind`'s `vars()`. Referenced in `tailwind.config.js` as `rgb(var(--color-*)/<alpha-value>)`
3. **gluestack-ui v3** — Pre-built UI components in `components/ui/` that use Tailwind classes internally

Metro config (`metro.config.js`) chains `withNativeWind` and `wrapWithReanimatedMetroConfig`. Babel config uses `nativewind/babel` preset and `module-resolver` for `@/` path alias.

### Dark Mode

Controlled via `tailwind.constants.js` (`DARK_MODE` set to `"class"`). The `GluestackUIProvider` in `components/ui/gluestack-ui-provider/` applies the active theme's CSS variables. Color scheme is read from NativeWind's `useColorScheme` (re-exported from `hooks/useColorScheme.ts`).

### Component Library

`components/ui/` contains ~50 gluestack-ui components. Many have platform-specific variants (e.g., `index.tsx` + `index.web.tsx` + `styles.tsx`). Import from `@/components/ui/<component-name>`.

### Key Files Not to Modify

- `components/GluestackInitializer.tsx` — marked as "should not be updated"
- The `ErrorBoundary` and `GluestackInitializer` wrappers in `app/_layout.tsx` must not be removed

### Error Tracking

CatDoes Watch SDK (`@catdoes/watch`) is integrated via `catdoes.watch.ts`. Enabled by setting `EXPO_PUBLIC_CATDOES_WATCH_KEY` env var. The `ErrorBoundary` component uses `WatchErrorBoundary` for automatic error reporting.

### Path Aliases

`@/` maps to the project root (configured in both `tsconfig.json` and `babel.config.js` via `module-resolver`). `tailwind.config` alias points to `./tailwind.config.js`.

### Additional Babel Plugins

Add custom plugins in `babel.plugins.js` (not `babel.config.js`). The `react-native-worklets/plugin` must remain last in the plugins array.

### Data Fetching

TanStack React Query (`@tanstack/react-query`) is included as a dependency.

### Icons

Uses `lucide-react-native` for icons.
