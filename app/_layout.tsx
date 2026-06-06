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
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { registerNotificationChannels } from "@/lib/notifications";

// Show notifications while app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import { ErrorBoundary } from "@/components/ErrorBoundary";
import GluestackInitializer from "@/components/GluestackInitializer";
import useColorScheme from "@/hooks/useColorScheme";
import { Stack } from "expo-router";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SessionsProvider } from "@/contexts/SessionsContext";
import { initializeRevenueCat } from "@/lib/revenuecat";
import { initCatDoesWatch } from "@/catdoes.watch";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
    BarlowCondensed_400Regular,
    BarlowCondensed_700Bold,
  });

  useEffect(() => {
    initCatDoesWatch();
    try {
      initializeRevenueCat();
    } catch (err: unknown) {
      console.warn(
        "RevenueCat init failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    void registerNotificationChannels();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  /*
   * IMPORTANT: DO NOT REMOVE GluestackInitializer OR ErrorBoundary */
  return (
    <SubscriptionProvider>
      <SessionsProvider>
      <ErrorBoundary>
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
          <StatusBar style="auto" />
        </GluestackInitializer>
      </ErrorBoundary>
      </SessionsProvider>
    </SubscriptionProvider>
  );
}