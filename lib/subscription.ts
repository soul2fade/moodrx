import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = '@moodrx_premium';
const TRIAL_NUDGE_KEY = '@moodrx_trial_start';

/** Wipe legacy premium flag and trial anchor from local storage.
 *  Called during full app reset (see lib/reset-app.ts). */
export async function clearTrial(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TRIAL_NUDGE_KEY, PREMIUM_KEY]);
  } catch {
    // ignore
  }
}
