import "@/global.css";
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { Alert } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import GluestackInitializer from "@/components/GluestackInitializer";
import useColorScheme from "@/hooks/useColorScheme";
import { Stack } from "expo-router";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { initializeRevenueCat } from "@/lib/revenuecat";

// Initialize CatDoes Watch for error tracking
// Set EXPO_PUBLIC_CATDOES_WATCH_KEY in your environment to enable
import { initCatDoesWatch } from "@/catdoes.watch";
initCatDoesWatch();

try {
  initializeRevenueCat();
} catch (err: unknown) {
  Alert.alert("RevenueCat Unavailable", err instanceof Error ? err.message : "Unknown error");
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
  });

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
    </SubscriptionProvider>
  );
}