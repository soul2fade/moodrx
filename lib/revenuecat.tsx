import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium';

function getRevenueCatApiKey(): string {
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '';
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

  if (!testKey || !iosKey || !androidKey) {
    throw new Error('RevenueCat public API keys are not configured. Set EXPO_PUBLIC_REVENUECAT_*.');
  }

  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return testKey;
  }
  if (Platform.OS === 'ios') return iosKey;
  if (Platform.OS === 'android') return androidKey;
  return testKey;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  console.log('RevenueCat configured');
}
