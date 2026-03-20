import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRODUCT_IDS = {
  monthly: 'moodrx_monthly_699',
  yearly: 'moodrx_yearly_4999',
};

const PREMIUM_KEY = '@moodrx_premium';

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