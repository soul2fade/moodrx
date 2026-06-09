import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Session, MoodKey } from './storage';
import { getSessions, getStreak, getSupplementReminderPrefs } from './storage';
import { getSupplementsForMood } from './supplements';

export const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';
export const REMINDER_TIME_KEY = 'reminder_time';
export const REMINDER_SCHEDULE_KEY = '@moodrx_reminder_schedule';

/** Single Android notification channel used by all MoodRx reminders.
 *  Must be registered before any scheduleNotificationAsync call on
 *  Android 8+ or some OEMs silently drop the notification. */
export const NOTIFICATION_CHANNEL_ID = 'moodrx-reminders';

/** Notification action category for daily check-in reminders. Tapping the
 *  "Log it" action (or the notification body) opens the app to the mood
 *  picker — see the response listener in app/_layout.tsx. */
export const CHECKIN_CATEGORY_ID = 'checkin';
const LOG_MOOD_ACTION_ID = 'LOG_MOOD';

/** Route opened when a check-in reminder (or its action) is tapped. Carried
 *  in the notification's `data` so the response listener stays generic. */
export const CHECKIN_NOTIF_ROUTE = '/home';

let channelRegistered = false;
let categoriesRegistered = false;

export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (channelRegistered) return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Reminders',
      description: 'Daily check-ins, workout reminders, supplement nudges, and trial notifications.',
      importance: Notifications.AndroidImportance.DEFAULT,
      enableVibrate: true,
      showBadge: false,
    });
    channelRegistered = true;
  } catch (e) {
    console.warn('[MoodRx] registerNotificationChannels failed:', e);
  }
}

/** Register notification action categories (iOS + Android — NOT web). The
 *  'checkin' category adds a one-tap "Log it" button to the daily reminder
 *  that opens the app to the mood picker. Idempotent. */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (categoriesRegistered) return;
  try {
    await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY_ID, [
      {
        identifier: LOG_MOOD_ACTION_ID,
        buttonTitle: 'Log it',
        options: { opensAppToForeground: true },
      },
    ]);
    categoriesRegistered = true;
  } catch (e) {
    console.warn('[MoodRx] registerNotificationCategories failed:', e);
  }
}

export interface ReminderSchedule {
  weekdayLabel: string;
  weekendLabel: string;
  splitWeekends: boolean;
}

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  weekdayLabel: '8:00 AM',
  weekendLabel: '10:00 AM',
  splitWeekends: false,
};

// Expo weekday: 1 = Sunday … 7 = Saturday
const WEEKDAY_NUMBERS = [2, 3, 4, 5, 6] as const;
const WEEKEND_NUMBERS = [7, 1] as const;

// Keys for storing scheduled notification identifiers so we can cancel individually
const CHECKIN_NOTIF_ID_KEY = '@moodrx_checkin_notif_id';
const CHECKIN_NOTIF_IDS_KEY = '@moodrx_checkin_notif_ids';
const SUPPLEMENT_NOTIF_ID_KEY = '@moodrx_supplement_notif_id';
const TRIAL_NOTIF_IDS_KEY = '@moodrx_trial_notif_ids';

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

/** Format an hour (0–23) + minute into the app's "h:mm AM/PM" label. */
export function formatTimeLabel(hour: number, minute: number): string {
  const isPM = hour >= 12;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

/** Parse a "h:mm AM/PM" label to 24-hour { hour, minute }, or null if it's
 *  not a valid time label. */
function parseTimeLabel(label: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (hour === 12) hour = 0;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return { hour, minute };
}

/** Resolve a reminder label to { hour, minute }. Accepts the 4 quick presets
 *  AND any custom "h:mm AM/PM" label (from the time picker); falls back to the
 *  first preset for anything unrecognized. */
export function getPresetFromLabel(label: string): { hour: number; minute: number } {
  const preset = PRESET_TIMES.find((p) => p.label === label);
  if (preset) return { hour: preset.hour, minute: preset.minute };
  return parseTimeLabel(label) ?? { hour: PRESET_TIMES[0].hour, minute: PRESET_TIMES[0].minute };
}

export async function getReminderSchedule(): Promise<ReminderSchedule> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReminderSchedule>;
      return {
        weekdayLabel: parsed.weekdayLabel ?? DEFAULT_REMINDER_SCHEDULE.weekdayLabel,
        weekendLabel: parsed.weekendLabel ?? DEFAULT_REMINDER_SCHEDULE.weekendLabel,
        splitWeekends: parsed.splitWeekends === true,
      };
    }
    const legacy = await AsyncStorage.getItem(REMINDER_TIME_KEY);
    if (legacy) {
      return { ...DEFAULT_REMINDER_SCHEDULE, weekdayLabel: legacy, weekendLabel: legacy };
    }
    return { ...DEFAULT_REMINDER_SCHEDULE };
  } catch {
    return { ...DEFAULT_REMINDER_SCHEDULE };
  }
}

export async function saveReminderSchedule(schedule: ReminderSchedule): Promise<void> {
  await AsyncStorage.setItem(REMINDER_SCHEDULE_KEY, JSON.stringify(schedule));
  await AsyncStorage.setItem(REMINDER_TIME_KEY, schedule.weekdayLabel);
}

async function cancelCheckinReminder(): Promise<void> {
  try {
    const idsRaw = await AsyncStorage.getItem(CHECKIN_NOTIF_IDS_KEY);
    if (idsRaw) {
      const ids = JSON.parse(idsRaw) as string[];
      await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
      await AsyncStorage.removeItem(CHECKIN_NOTIF_IDS_KEY);
    }
    const legacyId = await AsyncStorage.getItem(CHECKIN_NOTIF_ID_KEY);
    if (legacyId) {
      await Notifications.cancelScheduledNotificationAsync(legacyId);
      await AsyncStorage.removeItem(CHECKIN_NOTIF_ID_KEY);
    }
  } catch {
    // silently fail
  }
}

async function scheduleWeeklyCheckin(
  weekday: number,
  hour: number,
  minute: number,
  body: string,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'MoodRx',
      body,
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      data: { route: CHECKIN_NOTIF_ROUTE },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });
}

async function scheduleDailyCheckin(hour: number, minute: number, body: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'MoodRx',
      body,
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      data: { route: CHECKIN_NOTIF_ROUTE },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleCheckinReminders(
  schedule: ReminderSchedule,
  body = getStreakMessage(0),
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelCheckinReminder();
    const ids: string[] = [];

    if (schedule.splitWeekends) {
      const weekday = getPresetFromLabel(schedule.weekdayLabel);
      const weekend = getPresetFromLabel(schedule.weekendLabel);
      for (const day of WEEKDAY_NUMBERS) {
        ids.push(await scheduleWeeklyCheckin(day, weekday.hour, weekday.minute, body));
      }
      for (const day of WEEKEND_NUMBERS) {
        ids.push(await scheduleWeeklyCheckin(day, weekend.hour, weekend.minute, body));
      }
    } else {
      const preset = getPresetFromLabel(schedule.weekdayLabel);
      ids.push(await scheduleDailyCheckin(preset.hour, preset.minute, body));
    }

    await AsyncStorage.setItem(CHECKIN_NOTIF_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('[MoodRx] scheduleCheckinReminders failed:', e);
  }
}

export async function scheduleSmartReminder(hour: number, minute: number, streak = 0): Promise<void> {
  const label =
    PRESET_TIMES.find((p) => p.hour === hour && p.minute === minute)?.label ??
    DEFAULT_REMINDER_SCHEDULE.weekdayLabel;
  const schedule: ReminderSchedule = {
    weekdayLabel: label,
    weekendLabel: label,
    splitWeekends: false,
  };
  await saveReminderSchedule(schedule);
  await scheduleCheckinReminders(schedule, getStreakMessage(streak));
}

export async function rescheduleAfterSession(sessions: Session[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const enabledVal = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (enabledVal === 'true') {
      const schedule = await getReminderSchedule();
      if (!PRESET_TIMES.some((p) => p.label === schedule.weekdayLabel)) {
        schedule.weekdayLabel = PRESET_TIMES[0].label;
      }
      if (!PRESET_TIMES.some((p) => p.label === schedule.weekendLabel)) {
        schedule.weekendLabel = PRESET_TIMES[0].label;
      }

      await scheduleCheckinReminders(schedule, buildContextualMessage(sessions));
    }

    // Supplement reminders are independent of the check-in toggle. If the
    // user has them on, refresh the body so the "based on your latest
    // ANXIOUS session" copy reflects today's data, not whatever the
    // dominant mood was when they first turned the reminder on.
    const suppPrefs = await getSupplementReminderPrefs();
    if (suppPrefs.enabled) {
      const preset = SUPPLEMENT_PRESET_TIMES.find((p) => p.label === suppPrefs.timeLabel);
      if (preset) {
        await scheduleSupplementReminder(preset.hour, preset.minute);
      }
    }
  } catch (e) {
    console.warn('[MoodRx] rescheduleAfterSession failed:', e);
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelCheckinReminder();
}

const TRIAL_NUDGES: { offsetDays: number; body: string }[] = [
  { offsetDays: 2, body: "Day 2. Your brain's trying to trick you again. Check in." },
  { offsetDays: 5, body: "5 sessions deep. The data doesn't lie. Keep going." },
  { offsetDays: 6, body: "1 day left on your trial. Don't let momentum die here." },
];

export async function scheduleTrialNudges(trialStartMs: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelTrialNudges();
    const now = Date.now();
    const ids: string[] = [];
    // Anchor on local-midnight of the start date BEFORE adding offset days,
    // and step days via setDate(getDate()+N) which is DST-safe. Adding raw
    // 86 400 000 ms to a unix timestamp and then calling setHours(18,...)
    // misfires by one day for users whose local date of trialStartMs
    // differs from the UTC date (trials started near local midnight).
    const startLocalMidnight = new Date(trialStartMs);
    startLocalMidnight.setHours(0, 0, 0, 0);
    for (const nudge of TRIAL_NUDGES) {
      const triggerDate = new Date(startLocalMidnight.getTime());
      triggerDate.setDate(triggerDate.getDate() + nudge.offsetDays);
      triggerDate.setHours(18, 0, 0, 0);
      if (triggerDate.getTime() > now) {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: 'MoodRx', body: nudge.body, ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        ids.push(id);
      }
    }
    if (ids.length > 0) {
      await AsyncStorage.setItem(TRIAL_NOTIF_IDS_KEY, JSON.stringify(ids));
    }
  } catch (e) {
    console.warn('[MoodRx] scheduleTrialNudges failed:', e);
  }
}

export async function cancelTrialNudges(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const idsRaw = await AsyncStorage.getItem(TRIAL_NOTIF_IDS_KEY);
    if (idsRaw) {
      const ids = JSON.parse(idsRaw) as string[];
      await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
      await AsyncStorage.removeItem(TRIAL_NOTIF_IDS_KEY);
    }
  } catch {
    // silently fail
  }
}

export async function enableRemindersFromPrompt(trialStartMs?: number | null): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
    const schedule = await getReminderSchedule();
    await scheduleCheckinReminders(schedule);

    if (trialStartMs) {
      await scheduleTrialNudges(trialStartMs);
    }
    return true;
  } catch {
    return false;
  }
}

/** Cancel every OS-scheduled notification this app set up. Leaves the
 *  user's stored reminder preferences alone — call this when something
 *  invalidated the schedule (permissions revoked, signup flow restarting)
 *  and the user might re-enable reminders later. */
export async function cancelAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelReminders();
  await cancelSupplementReminder();
  await cancelTrialNudges();
}

/** Cancel schedules AND wipe the AsyncStorage flags that record the user's
 *  reminder preferences. Only the full-reset flow should use this — every
 *  other caller wants `cancelAllScheduledNotifications` so the user's
 *  "I want morning check-ins at 8am" choice survives the cancellation. */
export async function clearAllNotificationState(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelAllScheduledNotifications();
  try {
    await AsyncStorage.multiRemove([
      NOTIFICATIONS_ENABLED_KEY,
      REMINDER_TIME_KEY,
      REMINDER_SCHEDULE_KEY,
    ]);
  } catch {
    // non-critical
  }
}

/** @deprecated Use clearAllNotificationState for reset flows or
 *  cancelAllScheduledNotifications for cancel-only flows. Kept as an alias
 *  for one release so external callers don't break. */
export const cancelAllNotifications = clearAllNotificationState;

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
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(SUPPLEMENT_NOTIF_ID_KEY, id);
  } catch (e) {
    console.warn('[MoodRx] scheduleSupplementReminder failed:', e);
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
