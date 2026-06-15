import "@/global.css";
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { setAudioModeAsync } from "expo-audio";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { Stack, router, type Href } from "expo-router";
import { registerNotificationChannels, registerNotificationCategories } from "@/lib/notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GluestackInitializer from "@/components/GluestackInitializer";
import useColorScheme from "@/hooks/useColorScheme";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SessionsProvider } from "@/contexts/SessionsContext";
import { initializeRevenueCat } from "@/lib/revenuecat";

/** Routes that notification `data.route` is allowed to navigate to.
 *  Prevents a stale/renamed route string from pushing to a dead screen. */
const ALLOWED_NOTIF_ROUTES = ['/home'];

// Show notifications while app is in the foreground.
// Stays at module top-level (not inside useEffect) so the handler is
// registered synchronously at module load — before any notification
// can fire from a cold launch into a background-delivered notification.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
    BarlowCondensed_400Regular,
    BarlowCondensed_700Bold,
  });
  // Render once fonts resolve OR fail. Without the error branch, a failed
  // font asset (corrupt download, OTA asset mismatch) leaves `loaded` false
  // forever — `if (!loaded) return null` then renders nothing and the
  // splash (hidden only on `loaded`) never lifts, so the app hangs on a
  // frozen splash with no error and no recovery. Falling back to system
  // fonts is strictly better than an unrecoverable hang.
  const fontsReady = loaded || !!fontError;

  useEffect(() => {
    try {
      initializeRevenueCat();
    } catch (err: unknown) {
      console.warn(
        "RevenueCat init failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    void registerNotificationChannels();
    void registerNotificationCategories();
    // Play soundscapes/coach audio through the iOS silent switch. Foreground only
    // (shouldPlayInBackground: false) — true background audio needs the iOS
    // background-audio capability, which has separate App Store review scope.
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  // Route to the screen carried in a notification's `data.route` when the user
  // taps the notification or one of its action buttons (e.g. the check-in
  // reminder's "Log it"). Handles both cold start (app launched by the tap,
  // via getLastNotificationResponseAsync) and warm taps (listener). The app
  // had no notification-response handling before this.
  useEffect(() => {
    const goToRoute = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data;
      const route = data && typeof data.route === "string" ? data.route : null;
      if (route && ALLOWED_NOTIF_ROUTES.includes(route)) router.navigate(route as Href);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(goToRoute)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(goToRoute);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  /*
   * IMPORTANT: DO NOT REMOVE GluestackInitializer OR ErrorBoundary
   *
   * ErrorBoundary sits OUTSIDE the providers so a throw in SubscriptionProvider
   * or SessionsProvider init (RC SDK config error, AsyncStorage parse failure,
   * etc.) is caught and surfaces the fallback UI with a Try Again button —
   * not a permanent blank screen.
   */
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SubscriptionProvider>
          <SessionsProvider>
            <GluestackInitializer colorScheme={colorScheme}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#0a0a0a' },
                  animation: 'fade',
                }}
              >
                <Stack.Screen name="+not-found" />
                <Stack.Screen name="premium" />
              </Stack>
              <StatusBar style="light" />
            </GluestackInitializer>
          </SessionsProvider>
        </SubscriptionProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}