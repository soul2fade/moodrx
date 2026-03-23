import AsyncStorage from '@react-native-async-storage/async-storage';

export type MoodKey = 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good';

export interface Session {
  id: string;
  mood: MoodKey;
  intensity: number;
  postScore: number;
  workoutName: string;
  workoutId?: string;
  duration: number;
  timestamp: number;
  rating?: 'yes' | 'somewhat' | 'no';
}

export interface SupplementLog {
  date: string; // YYYY-MM-DD
  supplementName: string;
  taken: boolean;
}

export interface CustomWorkout {
  id: string;
  mood: MoodKey;
  name: string;
  duration: number;
  intensity: 'Light' | 'Moderate' | 'Intense';
  steps: string[];
  vibe: string;
  isCustom: true;
}

const FIRST_LAUNCH_KEY = '@moodrx_first_launch_done';
const SESSIONS_KEY = '@moodrx_sessions';
const SUPPLEMENT_LOGS_KEY = 'supplement_logs';
const CUSTOM_WORKOUTS_KEY = 'custom_workouts';

export async function getFirstLaunchDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setFirstLaunchDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
  } catch {
    // ignore
  }
}

export async function getSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

export async function addSession(session: Session): Promise<void> {
  const existing = await getSessions();
  existing.push(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
}

export async function clearSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
  } catch {
    // ignore
  }
}

export async function getSupplementLogs(): Promise<SupplementLog[]> {
  try {
    const raw = await AsyncStorage.getItem(SUPPLEMENT_LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SupplementLog[];
  } catch {
    return [];
  }
}

export async function saveSupplementLog(log: SupplementLog): Promise<void> {
  try {
    const existing = await getSupplementLogs();
    const idx = existing.findIndex(
      (l) => l.date === log.date && l.supplementName === log.supplementName
    );
    if (idx !== -1) {
      existing[idx] = log;
    } else {
      existing.push(log);
    }
    await AsyncStorage.setItem(SUPPLEMENT_LOGS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export async function getSupplementLogsForDate(date: string): Promise<SupplementLog[]> {
  const all = await getSupplementLogs();
  return all.filter((l) => l.date === date);
}

export async function toggleSupplementLog(supplementName: string, date: string): Promise<void> {
  try {
    const all = await getSupplementLogs();
    const idx = all.findIndex((l) => l.date === date && l.supplementName === supplementName);
    if (idx === -1) {
      all.push({ date, supplementName, taken: true });
    } else if (all[idx].taken) {
      all[idx].taken = false;
    } else {
      all[idx].taken = true;
    }
    await AsyncStorage.setItem(SUPPLEMENT_LOGS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export async function getCustomWorkouts(): Promise<CustomWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_WORKOUTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomWorkout[];
  } catch {
    return [];
  }
}

export async function saveCustomWorkout(workout: CustomWorkout): Promise<void> {
  try {
    const existing = await getCustomWorkouts();
    existing.push(workout);
    await AsyncStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export async function deleteCustomWorkout(id: string): Promise<void> {
  try {
    const existing = await getCustomWorkouts();
    const filtered = existing.filter((w) => w.id !== id);
    await AsyncStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

function toDateString(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return today's YYYY-MM-DD in local time — DST-safe */
function todayDateString(): string {
  return toDateString(Date.now());
}

/** Return yesterday's YYYY-MM-DD in local time — DST-safe (avoids 86400000 constant) */
function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d.getTime());
}

export function getStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;

  const uniqueDates = Array.from(new Set(sessions.map((s) => toDateString(s.timestamp)))).sort();
  const uniqueSet = new Set(uniqueDates);

  const today = todayDateString();
  const yesterday = yesterdayDateString();

  // If neither today nor yesterday is in the set, streak is 0
  if (!uniqueSet.has(today) && !uniqueSet.has(yesterday)) return 0;

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  // If the user hasn't checked in today yet, start counting from yesterday
  if (!uniqueSet.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = toDateString(checkDate.getTime());
    if (uniqueSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getAverageChange(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const total = sessions.reduce((sum, s) => sum + (s.postScore - s.intensity), 0);
  return total / sessions.length;
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      SESSIONS_KEY,
      SUPPLEMENT_LOGS_KEY,
      CUSTOM_WORKOUTS_KEY,
      FIRST_LAUNCH_KEY,
    ]);
  } catch {
    // ignore
  }
}

const NOTIF_PROMPT_SHOWN_KEY = '@moodrx_notif_prompt_shown';

export async function getNotifPromptShown(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NOTIF_PROMPT_SHOWN_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setNotifPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PROMPT_SHOWN_KEY, 'true');
  } catch {
    // ignore
  }
}