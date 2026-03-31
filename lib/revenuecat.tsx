import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

const REVENUECAT_TEST_API_KEY = 'test_dLQldoOvEOufmPZoFoJRXfpqWQU';
const REVENUECAT_IOS_API_KEY = 'appl_cVmaSBaUVAlgatSJqDmFjVXReRD';
const REVENUECAT_ANDROID_API_KEY = 'goog_CcFgmogOBsOonqVQhWkBfyWWlKM';

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium';

function getRevenueCatApiKey(): string {
  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error('RevenueCat API key not found');
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  console.log('RevenueCat configured');
}
