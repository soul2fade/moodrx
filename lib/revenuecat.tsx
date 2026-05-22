import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium';

function getRevenueCatApiKey(): string | null {
  const testKey    = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY    ?? '';
  const iosKey     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY     ?? '';
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return testKey || null;
  }
  if (Platform.OS === 'ios')     return iosKey     || testKey || null;
  if (Platform.OS === 'android') return androidKey || testKey || null;
  return testKey || null;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('[MoodRx] RevenueCat skipped — no API key for this platform/environment.');
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey });
}
