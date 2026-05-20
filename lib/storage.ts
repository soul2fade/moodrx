import AsyncStorage from '@react-native-async-storage/async-storage';
import { toDateString, todayDateString, yesterdayDateString } from './dateUtils';

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
  note?: string;
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

// ─── Simple in-memory cache to avoid redundant AsyncStorage reads ───
let sessionsCache: Session[] | null = null;
let sessionsCacheTime = 0;
let supplementsCache: SupplementLog[] | null = null;
let supplementsCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

// Small/rarely-changing values: cache indefinitely, invalidate on write.
let userProfileCache: UserProfile | null = null;
let streakStateCache: StreakState | null = null;
let personalBestsCache: Record<string, PersonalBest> | null = null;
let notifPromptShownCache: boolean | null = null;
let homeHintSeenCache: boolean | null = null;
let carouselHintSeenCache: boolean | null = null;

function invalidateSessionsCache() {
  sessionsCache = null;
  sessionsCacheTime = 0;
}

function invalidateSupplementsCache() {
  supplementsCache = null;
  supplementsCacheTime = 0;
}

function invalidateLightCaches() {
  userProfileCache = null;
  streakStateCache = null;
  personalBestsCache = null;
  notifPromptShownCache = null;
  homeHintSeenCache = null;
  carouselHintSeenCache = null;
}

export async function getFirstLaunchDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return value === 'true';
  } catch (e) {
    console.warn('[MoodRx] getFirstLaunchDone failed:', e);
    return false;
  }
}

export async function setFirstLaunchDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
  } catch (e) {
    console.warn('[MoodRx] setFirstLaunchDone failed:', e);
  }
}

export async function getSessions(): Promise<Session[]> {
  const now = Date.now();
  if (sessionsCache && now - sessionsCacheTime < CACHE_TTL) {
    return sessionsCache;
  }
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) {
      sessionsCache = [];
      sessionsCacheTime = now;
      return [];
    }
    const parsed = JSON.parse(raw) as Session[];
    sessionsCache = parsed;
    sessionsCacheTime = now;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] getSessions failed:', e);
    return [];
  }
}

export async function addSession(session: Session): Promise<void> {
  const existing = await getSessions();
  existing.push(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
  invalidateSessionsCache();
}

export async function clearSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
    invalidateSessionsCache();
  } catch (e) {
    console.warn('[MoodRx] clearSessions failed:', e);
  }
}

export async function getSupplementLogs(): Promise<SupplementLog[]> {
  const now = Date.now();
  if (supplementsCache && now - supplementsCacheTime < CACHE_TTL) {
    return supplementsCache;
  }
  try {
    const raw = await AsyncStorage.getItem(SUPPLEMENT_LOGS_KEY);
    if (!raw) {
      supplementsCache = [];
      supplementsCacheTime = now;
      return [];
    }
    const parsed = JSON.parse(raw) as SupplementLog[];
    supplementsCache = parsed;
    supplementsCacheTime = now;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] getSupplementLogs failed:', e);
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
    invalidateSupplementsCache();
  } catch (e) {
    console.warn('[MoodRx] saveSupplementLog failed:', e);
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
    invalidateSupplementsCache();
  } catch (e) {
    console.warn('[MoodRx] toggleSupplementLog failed:', e);
  }
}

export async function getCustomWorkouts(): Promise<CustomWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_WORKOUTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomWorkout[];
  } catch (e) {
    console.warn('[MoodRx] getCustomWorkouts failed:', e);
    return [];
  }
}

export async function saveCustomWorkout(workout: CustomWorkout): Promise<void> {
  try {
    const existing = await getCustomWorkouts();
    existing.push(workout);
    await AsyncStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('[MoodRx] saveCustomWorkout failed:', e);
  }
}

export async function deleteCustomWorkout(id: string): Promise<void> {
  try {
    const existing = await getCustomWorkouts();
    const filtered = existing.filter((w) => w.id !== id);
    await AsyncStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[MoodRx] deleteCustomWorkout failed:', e);
  }
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

export type MoodIdentity = {
  label: string;
  dominantMood: MoodKey;
  sessionCount: number;
};

const MOOD_IDENTITY_LABELS: Record<MoodKey, string> = {
  anxious: 'Chronic Overthinker',
  low: 'Heavy Lifter',
  foggy: 'Fog Walker',
  restless: 'Caged Runner',
  stressed: 'Pressure Cooker',
  good: 'Momentum Builder',
};

export function getMoodIdentity(sessions: Session[]): MoodIdentity | null {
  if (sessions.length < 5) return null;
  const counts: Partial<Record<MoodKey, number>> = {};
  for (const s of sessions) counts[s.mood] = (counts[s.mood] ?? 0) + 1;
  let max = 0;
  let dominant: MoodKey = 'anxious';
  for (const key of Object.keys(counts) as MoodKey[]) {
    if ((counts[key] ?? 0) > max) { max = counts[key] ?? 0; dominant = key; }
  }
  return { label: MOOD_IDENTITY_LABELS[dominant], dominantMood: dominant, sessionCount: sessions.length };
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
      USER_PROFILE_KEY,
      STREAK_STATE_KEY,
      PERSONAL_BESTS_KEY,
      NOTIF_PROMPT_SHOWN_KEY,
      HOME_HINT_SEEN_KEY,
      CAROUSEL_HINT_SEEN_KEY,
    ]);
    invalidateSessionsCache();
    invalidateSupplementsCache();
    invalidateLightCaches();
  } catch (e) {
    console.warn('[MoodRx] clearAllData failed:', e);
  }
}

export interface UserProfile {
  preferredTime?: 'Morning' | 'Afternoon' | 'Evening';
  primaryGoal?: 'Stress relief' | 'Energy' | 'Sleep' | 'Mood';
}

const USER_PROFILE_KEY = '@moodrx_user_profile';

export async function getUserProfile(): Promise<UserProfile> {
  if (userProfileCache) return userProfileCache;
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    const parsed = raw ? (JSON.parse(raw) as UserProfile) : {};
    userProfileCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] getUserProfile failed:', e);
    return {};
  }
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    userProfileCache = profile;
  } catch (e) {
    console.warn('[MoodRx] setUserProfile failed:', e);
  }
}

const STREAK_STATE_KEY = '@moodrx_streak_state';

export interface StreakState {
  hwm: number;           // all-time high watermark streak
  lastBrokenDate: string | null;   // YYYY-MM-DD when last streak was broken
  lastBrokenHwm: number; // what the streak was when it broke
  seenMilestones?: number[]; // milestones (3/7/14/30) the user has dismissed
}

export async function getStreakState(): Promise<StreakState> {
  if (streakStateCache) return streakStateCache;
  try {
    const raw = await AsyncStorage.getItem(STREAK_STATE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as StreakState)
      : { hwm: 0, lastBrokenDate: null, lastBrokenHwm: 0, seenMilestones: [] };
    streakStateCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] getStreakState failed:', e);
    return { hwm: 0, lastBrokenDate: null, lastBrokenHwm: 0 };
  }
}

export async function saveStreakState(state: StreakState): Promise<void> {
  try {
    await AsyncStorage.setItem(STREAK_STATE_KEY, JSON.stringify(state));
    streakStateCache = state;
  } catch (e) {
    console.warn('[MoodRx] saveStreakState failed:', e);
  }
}

const PERSONAL_BESTS_KEY = '@moodrx_personal_bests';

export interface PersonalBest {
  reps: number;
  date: string;
}

async function loadPersonalBests(): Promise<Record<string, PersonalBest>> {
  if (personalBestsCache) return personalBestsCache;
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_BESTS_KEY);
    const parsed: Record<string, PersonalBest> = raw ? JSON.parse(raw) : {};
    personalBestsCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] loadPersonalBests failed:', e);
    return {};
  }
}

export async function getPersonalBest(workoutId: string): Promise<PersonalBest | null> {
  const all = await loadPersonalBests();
  return all[workoutId] ?? null;
}

export async function savePersonalBest(workoutId: string, reps: number): Promise<void> {
  try {
    const all = await loadPersonalBests();
    const updated = { ...all, [workoutId]: { reps, date: todayDateString() } };
    await AsyncStorage.setItem(PERSONAL_BESTS_KEY, JSON.stringify(updated));
    personalBestsCache = updated;
  } catch (e) {
    console.warn('[MoodRx] savePersonalBest failed:', e);
  }
}

const NOTIF_PROMPT_SHOWN_KEY = '@moodrx_notif_prompt_shown';

export async function getNotifPromptShown(): Promise<boolean> {
  if (notifPromptShownCache !== null) return notifPromptShownCache;
  try {
    const val = (await AsyncStorage.getItem(NOTIF_PROMPT_SHOWN_KEY)) === 'true';
    notifPromptShownCache = val;
    return val;
  } catch (e) {
    console.warn('[MoodRx] getNotifPromptShown failed:', e);
    return false;
  }
}

export async function setNotifPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PROMPT_SHOWN_KEY, 'true');
    notifPromptShownCache = true;
  } catch (e) {
    console.warn('[MoodRx] setNotifPromptShown failed:', e);
  }
}

const HOME_HINT_SEEN_KEY = '@moodrx_home_hint_seen';
const CAROUSEL_HINT_SEEN_KEY = '@moodrx_carousel_hint_seen';
const CAROUSEL_PAGE_KEY = '@moodrx_carousel_page';

export async function getLastCarouselPage(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(CAROUSEL_PAGE_KEY);
    if (val === null) return 0;
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0;
  } catch {
    return 0;
  }
}

export async function setLastCarouselPage(page: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CAROUSEL_PAGE_KEY, String(page));
  } catch {
    // non-critical
  }
}

export async function getHomeHintSeen(): Promise<boolean> {
  if (homeHintSeenCache !== null) return homeHintSeenCache;
  try {
    const val = (await AsyncStorage.getItem(HOME_HINT_SEEN_KEY)) === 'true';
    homeHintSeenCache = val;
    return val;
  } catch {
    return false;
  }
}

export async function setHomeHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_HINT_SEEN_KEY, 'true');
    homeHintSeenCache = true;
  } catch {
    // non-critical
  }
}

export async function getCarouselHintSeen(): Promise<boolean> {
  if (carouselHintSeenCache !== null) return carouselHintSeenCache;
  try {
    const val = (await AsyncStorage.getItem(CAROUSEL_HINT_SEEN_KEY)) === 'true';
    carouselHintSeenCache = val;
    return val;
  } catch {
    return false;
  }
}

export async function setCarouselHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(CAROUSEL_HINT_SEEN_KEY, 'true');
    carouselHintSeenCache = true;
  } catch {
    // non-critical
  }
}
