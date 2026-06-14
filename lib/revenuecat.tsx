import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium'; // base unlock (non-consumable)

/** RevenueCat package identifier for the one-time base unlock, in the
 *  `default` offering. ($rc_lifetime is RevenueCat's reserved package
 *  slot for a non-consumable/lifetime product.) */
export const BASE_UNLOCK_PACKAGE_ID = '$rc_lifetime';

/** Offering that holds purchasable content packs (empty at launch). */
export const PACKS_OFFERING_ID = 'packs';

/** Offering holding the MoodRx+ subscription products (monthly + annual). */
export const PLUS_OFFERING_ID = 'plus';

/** Pack id for the one-time "unlock all voices" bundle (a package in the
 *  `packs` offering). ownsPack(VOICE_PACK_ID) === owns all 4 paid coach voices.
 *  Its entitlement is packEntitlementId('voice_pack') === 'pack_voice_pack'. */
export const VOICE_PACK_ID = 'voice_pack';

/** Entitlement granted by a future all-access subscription. Checked by
 *  ownsPack() so adding the sub later needs no consumer changes. */
export const ALL_ACCESS_ENTITLEMENT_IDENTIFIER = 'all_access';

/** Per-pack entitlements are namespaced `pack_<id>`. */
export function packEntitlementId(packId: string): string {
  return `pack_${packId}`;
}

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
