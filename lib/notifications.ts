import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Session, MoodKey } from './storage';
import { getSessions, getStreak } from './storage';
import { getSupplementsForMood } from './supplements';

export const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';
export const REMINDER_TIME_KEY = 'reminder_time';

// Keys for storing scheduled notification identifiers so we can cancel individually
const CHECKIN_NOTIF_ID_KEY = '@moodrx_checkin_notif_id';
const SUPPLEMENT_NOTIF_ID_KEY = '@moodrx_supplement_notif_id';

export const PRESET_TIMES = [
  { label: '8:00 AM',  hour: 8,  minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '6:00 PM',  hour: 18, minute: 0 },
  { label: '9:00 PM',  hour: 21, minute: 0 },
];

export const SUPPLEMENT_PRESET_TIMES = [
  { label: '7:00 AM',  hour: 7,  minute: 0 },
  { label: '9:00 AM',  hour: 9,  minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '6:00 PM',  hour: 18, minute: 0 },
];

export const DEFAULT_SUPPLEMENT_TIME = '9:00 AM';

const MOOD_NAMES: Record<MoodKey, string> = {
  anxious:  'ANXIOUS',
  low:      'LOW',
  foggy:    'FOGGY',
  restless: 'RESTLESS',
  stressed: 'STRESSED',
  good:     'GOOD',
};

const ZERO_STREAK_MESSAGES = [
  "How bad is it today? Check in.",
  "Your brain's making excuses. Don't listen.",
  "One session changes everything. Start now.",
  "The data doesn't care how you feel. Neither do I. Check in.",
];

const STREAK_MESSAGES: { minStreak: number; body: string }[] = [
  { minStreak: 30, body: 'Day {n}. The app can barely keep up with you.' },
  { minStreak: 14, body: 'Day {n}. This is becoming who you are.' },
  { minStreak: 7, body: 'Day {n}. Still here. Good.' },
  { minStreak: 6, body: 'One week straight. That\'s not luck. That\'s discipline.' },
  { minStreak: 4, body: '{n} days in a row. You\'re not most people.' },
  { minStreak: 3, body: '{n}-day streak. Keep the momentum going.' },
  { minStreak: 2, body: 'Two days straight. Don\'t blow it now.' },
  { minStreak: 1, body: 'Day one\'s done. Day two is where most people quit.' },
];

function getStreakMessage(streak: number): string {
  if (streak <= 0) {
    return ZERO_STREAK_MESSAGES[Math.floor(Math.random() * ZERO_STREAK_MESSAGES.length)];
  }
  const entry = STREAK_MESSAGES.find((m) => streak >= m.minStreak) ?? STREAK_MESSAGES[STREAK_MESSAGES.length - 1];
  return entry.body.replace('{n}', String(streak));
}

const SUPPLEMENT_REMINDER_MESSAGES = [
  "Time for your morning stack. Don't skip it.",
  "Your supplements are waiting. Take them.",
  "Stack check: have you taken your supplements today?",
  "Consistency is the dose. Take your stack.",
];

const MOOD_DISPLAY_NAMES: Record<MoodKey, string> = {
  anxious:  'Anxious',
  low:      'Low',
  foggy:    'Foggy',
  restless: 'Restless',
  stressed: 'Stressed',
  good:     'Good',
};

function buildSupplementMessage(sessions: Session[]): string {
  if (sessions.length === 0) {
    return SUPPLEMENT_REMINDER_MESSAGES[Math.floor(Math.random() * SUPPLEMENT_REMINDER_MESSAGES.length)];
  }
  const last = sessions[sessions.length - 1];
  const moodName = MOOD_DISPLAY_NAMES[last.mood] ?? last.mood;
  const supplements = getSupplementsForMood(last.mood);
  if (supplements.length > 0) {
    return `Time for your ${moodName} stack — ${supplements[0].name} is up first.`;
  }
  return `Time for your ${moodName} stack. Take your supplements.`;
}

function buildContextualMessage(sessions: Session[]): string {
  if (sessions.length === 0) {
    return ZERO_STREAK_MESSAGES[Math.floor(Math.random() * ZERO_STREAK_MESSAGES.length)];
  }

  const streak = getStreak(sessions);
  const last = sessions[sessions.length - 1];
  const hoursAgo = (Date.now() - last.timestamp) / (1000 * 60 * 60);
  const change = last.postScore - last.intensity;
  const moodName = MOOD_NAMES[last.mood] ?? last.mood.toUpperCase();
  const changeStr = change >= 0 ? `+${change}` : `${change}`;

  if (hoursAgo >= 18 && hoursAgo < 54) {
    if (change >= 2) {
      return `Yesterday you were ${moodName}. ${last.workoutName} helped (${changeStr}). Go again?`;
    } else if (change <= -1) {
      return `You were ${moodName} yesterday. Rough session. Try a different approach today.`;
    } else {
      return `Yesterday: ${moodName}. Today's a chance to push it. Check in.`;
    }
  }

  if (hoursAgo >= 54 && hoursAgo < 120) {
    if (change >= 2) {
      return `${moodName} → better. You did it ${Math.round(hoursAgo / 24)} days ago. Do it again today.`;
    }
    return `Last time you checked in: ${moodName}. What's today look like?`;
  }

  if (streak === 0) {
    return ZERO_STREAK_MESSAGES[Math.floor(Math.random() * ZERO_STREAK_MESSAGES.length)];
  }
  return getStreakMessage(streak);
}

function inferPreferredHour(sessions: Session[]): number {
  if (sessions.length === 0) return 18;
  const recent = sessions.slice(-5);
  const avgHour = recent.reduce((sum, s) => sum + new Date(s.timestamp).getHours(), 0) / recent.length;
  const diffs = PRESET_TIMES.map(p => ({ p, d: Math.abs(p.hour - avgHour) }));
  diffs.sort((a, b) => a.d - b.d);
  return diffs[0].p.hour;
}

async function cancelCheckinReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(CHECKIN_NOTIF_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(CHECKIN_NOTIF_ID_KEY);
    }
  } catch {
    // silently fail
  }
}

export async function scheduleSmartReminder(hour: number, minute: number, streak = 0): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelCheckinReminder();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MoodRx',
        body: getStreakMessage(streak),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(CHECKIN_NOTIF_ID_KEY, id);
  } catch {
    // silently fail — Expo Go or permissions not granted
  }
}

export async function rescheduleAfterSession(sessions: Session[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const enabledVal = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (enabledVal !== 'true') return;

    const savedTimeLabel = await AsyncStorage.getItem(REMINDER_TIME_KEY);
    let hour: number;
    let minute = 0;

    if (savedTimeLabel) {
      const preset = PRESET_TIMES.find(p => p.label === savedTimeLabel);
      hour = preset?.hour ?? inferPreferredHour(sessions);
      minute = preset?.minute ?? 0;
    } else {
      hour = inferPreferredHour(sessions);
    }

    await cancelCheckinReminder();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MoodRx',
        body: buildContextualMessage(sessions),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(CHECKIN_NOTIF_ID_KEY, id);
  } catch {
    // ignore — permissions may not be granted
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelCheckinReminder();
}

export async function scheduleSupplementReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelSupplementReminder();
    const sessions = await getSessions();
    const msg = buildSupplementMessage(sessions);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MoodRx — Supplements',
        body: msg,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(SUPPLEMENT_NOTIF_ID_KEY, id);
  } catch {
    // silently fail
  }
}

export async function cancelSupplementReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const id = await AsyncStorage.getItem(SUPPLEMENT_NOTIF_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(SUPPLEMENT_NOTIF_ID_KEY);
    }
  } catch {
    // silently fail
  }
}
