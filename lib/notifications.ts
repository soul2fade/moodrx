import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';
export const REMINDER_TIME_KEY = 'reminder_time';

export const PRESET_TIMES = [
  { label: '8:00 AM',  hour: 8,  minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '6:00 PM',  hour: 18, minute: 0 },
  { label: '9:00 PM',  hour: 21, minute: 0 },
];

const STREAK_MESSAGES: Array<{ minStreak: number; body: string }> = [
  { minStreak: 30, body: "Day {n}. The app can barely keep up with you." },
  { minStreak: 14, body: "Day {n}. This is becoming who you are." },
  { minStreak: 7,  body: "Day {n}. Still here. Good." },
  { minStreak: 6,  body: "One week straight. That's not luck. That's discipline." },
  { minStreak: 4,  body: "{n} days in a row. You're not most people." },
  { minStreak: 3,  body: "{n}-day streak. Keep the momentum going." },
  { minStreak: 2,  body: "Three days straight. Don't blow it now." },
  { minStreak: 1,  body: "Two days in. Day two is where most people quit." },
  { minStreak: 0,  body: "Day one's done. Day two is where most people quit." },
];

const ZERO_STREAK_MESSAGES = [
  "How bad is it today? Check in.",
  "Your brain's making excuses. Don't listen.",
  "One session changes everything. Start now.",
  "The data doesn't care how you feel. Neither do I. Check in.",
];

function getStreakBody(streak: number): string {
  if (streak === 0) {
    return ZERO_STREAK_MESSAGES[Math.floor(Math.random() * ZERO_STREAK_MESSAGES.length)];
  }
  const entry = STREAK_MESSAGES.find((m) => streak >= m.minStreak) ?? STREAK_MESSAGES[STREAK_MESSAGES.length - 1];
  return entry.body.replace('{n}', String(streak));
}

export async function scheduleSmartReminder(hour: number, minute: number, streak = 0): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MoodRx',
        body: getStreakBody(streak),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {
    // silently fail — Expo Go or permissions not granted
  }
}

export async function rescheduleAfterSession(streak: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const [enabledVal, timeVal] = await Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY),
      AsyncStorage.getItem(REMINDER_TIME_KEY),
    ]);
    if (enabledVal !== 'true') return;
    const label = timeVal ?? '8:00 AM';
    const preset = PRESET_TIMES.find((p) => p.label === label) ?? PRESET_TIMES[0];
    await scheduleSmartReminder(preset.hour, preset.minute, streak);
  } catch {
    // ignore
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
