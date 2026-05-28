import { clearAllData } from './storage';
import { cancelAllNotifications } from './notifications';
import { clearHealthSyncPref } from './health';
import { clearTrial } from './subscription';

/** Wipes local app data and cancels all scheduled notifications. */
export async function resetAllAppData(): Promise<void> {
  await cancelAllNotifications();
  await clearAllData();
  await clearHealthSyncPref();
  await clearTrial();
}
