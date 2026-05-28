import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRODUCT_IDS = {
  monthly: 'moodrx_monthly_699',
  yearly: 'moodrx_yearly_4999',
};

const PREMIUM_KEY = '@moodrx_premium';
const TRIAL_NUDGE_KEY = '@moodrx_trial_start';

/** @deprecated Local premium flag — Pro access is driven by RevenueCat entitlements. */
export async function setPremiumStatus(value: boolean): Promise<void> {
  await AsyncStorage.setItem(PREMIUM_KEY, value ? 'true' : 'false');
}

/** Anchor for trial nurture push notifications (set when a store trial starts). */
export async function setTrialNudgeAnchor(ms: number): Promise<void> {
  await AsyncStorage.setItem(TRIAL_NUDGE_KEY, ms.toString());
}

export async function getTrialNudgeAnchorMs(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_NUDGE_KEY);
    if (!val) return null;
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function hasLegacyTrialAnchor(): Promise<boolean> {
  return (await getTrialNudgeAnchorMs()) !== null;
}

export async function clearTrial(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TRIAL_NUDGE_KEY, PREMIUM_KEY]);
  } catch {
    // ignore
  }
}
