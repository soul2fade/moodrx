import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { clearAllData } from './storage';
import { cancelAllNotifications } from './notifications';
import { clearHealthSyncPref } from './health';
import { clearTrial } from './subscription';

/** Wipes local app data, cancels scheduled notifications, and detaches the
 *  RevenueCat user. The RC logOut is best-effort — on web or when the SDK
 *  was never configured (no API key), calling it throws and we swallow. */
export async function resetAllAppData(): Promise<void> {
  await cancelAllNotifications();
  await clearAllData();
  await clearHealthSyncPref();
  await clearTrial();
  if (Platform.OS !== 'web') {
    try {
      await Purchases.logOut();
    } catch {
      // SDK not configured / already anonymous — nothing to detach.
    }
  }
}
