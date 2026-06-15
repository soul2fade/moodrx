import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { clearAllData } from './storage';
import { clearAllNotificationState } from './notifications';
import { clearHealthSyncPref } from './health';
import { clearTrial } from './subscription';

/** Wipes local app data, cancels scheduled notifications, and detaches the
 *  RevenueCat user. The RC logOut is best-effort — on web or when the SDK
 *  was never configured (no API key), calling it throws and we swallow. We
 *  skip logOut for an anonymous user: RevenueCat logs a loud error-level
 *  message ("Called logOut but the current user is anonymous") before
 *  rejecting, which LogBox surfaces as a red console error in dev even though
 *  we'd swallow the throw. There's nothing to detach when anonymous anyway. */
export async function resetAllAppData(): Promise<void> {
  await clearAllNotificationState();
  await clearAllData();
  await clearHealthSyncPref();
  await clearTrial();
  if (Platform.OS !== 'web') {
    try {
      if (!(await Purchases.isAnonymous())) {
        await Purchases.logOut();
      }
    } catch {
      // SDK not configured / already anonymous — nothing to detach.
    }
  }
}
