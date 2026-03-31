import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRODUCT_IDS = {
  monthly: 'moodrx_monthly_699',
  yearly: 'moodrx_yearly_4999',
};

const PREMIUM_KEY = '@moodrx_premium';
const TRIAL_KEY = '@moodrx_trial_start';
const TRIAL_DURATION_DAYS = 7;

export async function getPremiumStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PREMIUM_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setPremiumStatus(value: boolean): Promise<void> {
  await AsyncStorage.setItem(PREMIUM_KEY, value ? 'true' : 'false');
}

export async function startTrial(): Promise<void> {
  await AsyncStorage.setItem(TRIAL_KEY, Date.now().toString());
}

export interface TrialInfo {
  isInTrial: boolean;
  daysLeft: number;
  hasUsedTrial: boolean;
}

export async function getTrialStartMs(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_KEY);
    if (!val) return null;
    return parseInt(val, 10);
  } catch {
    return null;
  }
}

export async function getTrialInfo(): Promise<TrialInfo> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_KEY);
    if (!val) return { isInTrial: false, daysLeft: 0, hasUsedTrial: false };
    const startTime = parseInt(val, 10);
    const elapsedMs = Date.now() - startTime;
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - elapsedDays));
    return { isInTrial: daysLeft > 0, daysLeft, hasUsedTrial: true };
  } catch {
    return { isInTrial: false, daysLeft: 0, hasUsedTrial: false };
  }
}
