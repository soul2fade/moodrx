import AsyncStorage from '@react-native-async-storage/async-storage';
import { toDateString, todayDateString, yesterdayDateString } from './dateUtils';
import { clearUiState, invalidateUiStateCache, loadUiState, patchUiState } from './ui-state';

export type MoodKey = 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good';

/** Optional on-device health readings captured at session-log time
 *  (HealthKit / Health Connect). Absent on sessions logged without health
 *  sync — purely additive, so old records remain valid (no schema bump). */
export interface SessionHealthFields {
  /** Steps recorded for the day at log time, if health was available. */
  stepsToday?: number;
  /** Hours of sleep the night before the session, if available. */
  sleepHoursLastNight?: number;
}

export interface Session extends SessionHealthFields {
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
  lightDay?: boolean;
  /** Origin of the check-in. 'vent' = logged from the voice-vent flow. Absent
   *  for the normal prescription/form/quick-log paths. Additive + optional, so
   *  old records remain valid. */
  source?: 'vent';
  /** YYYY-MM-DD in the local timezone at write time. Persisted so streak
   *  and "today" checks survive timezone changes (travel, DST) without
   *  recomputing from the unix timestamp. Optional for sessions logged
   *  before this field existed — sessionDateString() falls back. */
  localDateString?: string;
}

/** Returns the session's day label (YYYY-MM-DD). Prefers the persisted
 *  localDateString (set at write time in the user's then-local timezone);
 *  falls back to recomputing from the timestamp for sessions written
 *  before the field existed. */
export function sessionDateString(s: Session): string {
  return s.localDateString ?? toDateString(s.timestamp);
}

// The six valid mood keys. Defined locally (not imported from ./moods) to
// avoid a circular import — moods.ts imports MoodKey from this file.
const VALID_MOODS: ReadonlySet<string> = new Set<MoodKey>([
  'anxious', 'low', 'foggy', 'restless', 'stressed', 'good',
]);

/** Defensive read-time normalization. Sessions are persisted from validated
 *  inputs, but a corrupted store, a hand-edited backup, or a future mood-key
 *  rename could surface a session whose `mood` is not one of the six known
 *  keys — which would crash every unguarded `MOODS[mood].color/.name` lookup
 *  downstream (home, insights, ShareCard, HomeCarousel, MoodIcon, etc.).
 *  Coerce unknown moods to a safe default and non-finite numbers to 0 so a
 *  single bad record can never feed undefined/NaN into rendering. Returns the
 *  same object reference when nothing needs fixing (the overwhelmingly common
 *  path) to avoid per-read allocations. */
function sanitizeSession(s: Session): Session {
  const mood = VALID_MOODS.has(s.mood) ? s.mood : 'anxious';
  const intensity = Number.isFinite(s.intensity) ? s.intensity : 0;
  const postScore = Number.isFinite(s.postScore) ? s.postScore : 0;
  const timestamp = Number.isFinite(s.timestamp) ? s.timestamp : 0;
  if (
    mood === s.mood &&
    intensity === s.intensity &&
    postScore === s.postScore &&
    timestamp === s.timestamp
  ) {
    return s;
  }
  return { ...s, mood, intensity, postScore, timestamp };
}

export interface SupplementLog {
  date: string; // YYYY-MM-DD
  supplementName: string;
  taken: boolean;
}

const FIRST_LAUNCH_KEY = '@moodrx_first_launch_done';
const GUIDED_SESSION_KEY = '@moodrx_guided_done';
const SESSIONS_KEY = '@moodrx_sessions';
const SUPPLEMENT_LOGS_KEY = 'supplement_logs';
const CUSTOM_WORKOUTS_KEY = 'custom_workouts';

// ─── Schema versioning for the array-shaped persistence keys ───
//
// Each versioned payload is stored as `{ version: number, data: T }`. Reads
// transparently accept the legacy unwrapped shape (`T` directly) so the very
// first read after this code ships still works, and the next write upgrades
// the on-disk format. When a future field rename / type change ships, bump
// SCHEMA_VERSION and dispatch on the stored `version` inside readVersioned.
const SCHEMA_VERSION = 1;

interface VersionedPayload<T> {
  version: number;
  data: T;
}

function isVersionedPayload<T>(value: unknown): value is VersionedPayload<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'data' in value &&
    typeof (value as { version: unknown }).version === 'number'
  );
}

/** Parse a raw AsyncStorage string, accepting both the wrapped
 *  `{version,data}` shape and the legacy unwrapped shape. The legacy
 *  branch lets every key migrate in-place: read returns the unwrapped
 *  data, the next write persists it wrapped. */
function readVersioned<T>(raw: string): T {
  const parsed: unknown = JSON.parse(raw);
  if (isVersionedPayload<T>(parsed)) {
    // Future: switch on parsed.version and run migrations before returning.
    return parsed.data;
  }
  return parsed as T;
}

function writeVersioned<T>(data: T): string {
  const payload: VersionedPayload<T> = { version: SCHEMA_VERSION, data };
  return JSON.stringify(payload);
}

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
let carouselHintSeenCache: boolean | null = null;
let reviewStateCache: ReviewState | null = null;

let sessionWriteChain: Promise<void> = Promise.resolve();
let supplementWriteChain: Promise<void> = Promise.resolve();

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
  carouselHintSeenCache = null;
  reviewStateCache = null;
  invalidateUiStateCache();
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

export async function getGuidedSessionDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(GUIDED_SESSION_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setGuidedSessionDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIDED_SESSION_KEY, 'true');
    await patchUiState({ navHintPending: true });
  } catch {
    // ignore
  }
}

export async function getSessions(): Promise<Session[]> {
  const now = Date.now();
  if (sessionsCache && now - sessionsCacheTime < CACHE_TTL) {
    // Defensive copy: callers that sort/splice the result must not mutate
    // the cached array (which the next addSession() reads to build the new
    // disk payload).
    return [...sessionsCache];
  }
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) {
      sessionsCache = [];
      sessionsCacheTime = now;
      return [];
    }
    const parsed = readVersioned<Session[]>(raw).map(sanitizeSession);
    sessionsCache = parsed;
    sessionsCacheTime = now;
    return [...parsed];
  } catch (e) {
    console.warn('[MoodRx] getSessions failed:', e);
    return [];
  }
}

export async function addSession(session: Session): Promise<void> {
  // Snapshot the local date once at write time so streak/today logic
  // doesn't shift under the user's feet when they travel across time
  // zones or DST flips inside the streak window.
  const enriched: Session = {
    ...session,
    localDateString: session.localDateString ?? toDateString(session.timestamp),
  };
  sessionWriteChain = sessionWriteChain.then(async () => {
    try {
      invalidateSessionsCache();
      const existing = await getSessions();
      const updated = [...existing, enriched];
      await AsyncStorage.setItem(SESSIONS_KEY, writeVersioned(updated));
      // Write-through: seed the cache with the post-write state so any read
      // landing inside the TTL window sees the new session immediately.
      sessionsCache = updated;
      sessionsCacheTime = Date.now();
    } catch (e) {
      // A rejected setItem (disk full / I/O error) must NOT poison the
      // shared write chain. Without this catch the chain promise would
      // reject, and every subsequent addSession would chain off a rejected
      // promise — silently dropping ALL future session writes for the rest
      // of the process. Swallow + invalidate cache so the next write retries
      // from disk. Mirrors saveSupplementLog/toggleSupplementLog, which
      // already guard their chains this way.
      console.warn('[MoodRx] addSession failed:', e);
      invalidateSessionsCache();
    }
  });
  return sessionWriteChain;
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
    return [...supplementsCache];
  }
  try {
    const raw = await AsyncStorage.getItem(SUPPLEMENT_LOGS_KEY);
    if (!raw) {
      supplementsCache = [];
      supplementsCacheTime = now;
      return [];
    }
    const parsed = readVersioned<SupplementLog[]>(raw);
    supplementsCache = parsed;
    supplementsCacheTime = now;
    return [...parsed];
  } catch (e) {
    console.warn('[MoodRx] getSupplementLogs failed:', e);
    return [];
  }
}

export async function saveSupplementLog(log: SupplementLog): Promise<void> {
  supplementWriteChain = supplementWriteChain.then(async () => {
    try {
      invalidateSupplementsCache();
      const existing = await getSupplementLogs();
      const idx = existing.findIndex(
        (l) => l.date === log.date && l.supplementName === log.supplementName
      );
      const updated = idx !== -1
        ? existing.map((l, i) => (i === idx ? log : l))
        : [...existing, log];
      await AsyncStorage.setItem(SUPPLEMENT_LOGS_KEY, writeVersioned(updated));
      supplementsCache = updated;
      supplementsCacheTime = Date.now();
    } catch (e) {
      console.warn('[MoodRx] saveSupplementLog failed:', e);
    }
  });
  return supplementWriteChain;
}

export async function getSupplementLogsForDate(date: string): Promise<SupplementLog[]> {
  const all = await getSupplementLogs();
  return all.filter((l) => l.date === date);
}

export async function toggleSupplementLog(supplementName: string, date: string): Promise<void> {
  supplementWriteChain = supplementWriteChain.then(async () => {
    try {
      invalidateSupplementsCache();
      const all = await getSupplementLogs();
      const idx = all.findIndex((l) => l.date === date && l.supplementName === supplementName);
      const updated = idx === -1
        ? [...all, { date, supplementName, taken: true }]
        : all.map((l, i) => (i === idx ? { ...l, taken: !l.taken } : l));
      await AsyncStorage.setItem(SUPPLEMENT_LOGS_KEY, writeVersioned(updated));
      supplementsCache = updated;
      supplementsCacheTime = Date.now();
    } catch (e) {
      console.warn('[MoodRx] toggleSupplementLog failed:', e);
    }
  });
  return supplementWriteChain;
}

export function hasSessionToday(sessions: Session[]): boolean {
  const today = todayDateString();
  return sessions.some((s) => sessionDateString(s) === today);
}

export function getStreakEncouragement(streak: number): string | null {
  if (streak === 1) return 'Day 1 in the books. Come back tomorrow.';
  if (streak === 2) return "Two days straight. That's momentum.";
  if (streak >= 3) return "You're on a roll. Don't blow it.";
  return null;
}

export function getStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;

  const uniqueDates = Array.from(new Set(sessions.map((s) => sessionDateString(s)))).sort();
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
      GUIDED_SESSION_KEY,
      USER_PROFILE_KEY,
      STREAK_STATE_KEY,
      PERSONAL_BESTS_KEY,
      SUPPLEMENT_REMINDER_PREFS_KEY,
      TRASH_TALK_VOLUME_KEY,
      VOICE_ENABLED_KEY,
      WORKOUT_FOCUS_MODE_KEY,
      WORKOUT_VOICE_MODE_KEY,
      // Health-sync opt-in must reset too — otherwise after "Reset all data"
      // the next launch silently re-syncs to HealthKit/Health Connect even
      // though the rest of the app behaves like a clean install.
      '@moodrx_health_enabled',
      '@moodrx_vent_consent',
      '@moodrx_vent_enabled',
      'notifications_enabled',
      'reminder_time',
      '@moodrx_reminder_schedule',
      '@moodrx_checkin_notif_id',
      '@moodrx_checkin_notif_ids',
      '@moodrx_supplement_notif_id',
      '@moodrx_trial_notif_ids',
      REVIEW_STATE_KEY,
    ]);
    await clearUiState();
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
    const parsed = raw ? JSON.parse(raw) : {};
    const profile = (parsed && typeof parsed === 'object') ? parsed as UserProfile : {};
    userProfileCache = profile;
    return profile;
  } catch (e) {
    console.warn('[MoodRx] getUserProfile failed:', e);
    return {};
  }
}

export async function setUserProfile(profile: Partial<UserProfile>): Promise<void> {
  try {
    // Merge instead of replace — a caller updating just `preferredTime`
    // should not wipe `primaryGoal`. Callers that intentionally want to
    // reset a field should pass an explicit `undefined`.
    const existing = await getUserProfile();
    const merged: UserProfile = { ...existing, ...profile };
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(merged));
    userProfileCache = merged;
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
    return { hwm: 0, lastBrokenDate: null, lastBrokenHwm: 0, seenMilestones: [] };
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
  if (personalBestsCache) return { ...personalBestsCache };
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_BESTS_KEY);
    const parsed: Record<string, PersonalBest> = raw
      ? readVersioned<Record<string, PersonalBest>>(raw)
      : {};
    personalBestsCache = parsed;
    return { ...parsed };
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
    await AsyncStorage.setItem(PERSONAL_BESTS_KEY, writeVersioned(updated));
    personalBestsCache = updated;
  } catch (e) {
    console.warn('[MoodRx] savePersonalBest failed:', e);
  }
}

export async function getNotifPromptShown(): Promise<boolean> {
  if (notifPromptShownCache !== null) return notifPromptShownCache;
  try {
    const state = await loadUiState();
    notifPromptShownCache = state.notifPromptShown;
    return state.notifPromptShown;
  } catch (e) {
    console.warn('[MoodRx] getNotifPromptShown failed:', e);
    return false;
  }
}

export async function setNotifPromptShown(): Promise<void> {
  try {
    await patchUiState({ notifPromptShown: true });
    notifPromptShownCache = true;
  } catch (e) {
    console.warn('[MoodRx] setNotifPromptShown failed:', e);
  }
}

export async function getLastCarouselPage(): Promise<number> {
  try {
    const state = await loadUiState();
    return state.lastCarouselPage;
  } catch {
    return 0;
  }
}

export async function setLastCarouselPage(page: number): Promise<void> {
  try {
    await patchUiState({ lastCarouselPage: page });
  } catch {
    // non-critical
  }
}

export async function getCarouselHintSeen(): Promise<boolean> {
  if (carouselHintSeenCache !== null) return carouselHintSeenCache;
  try {
    const state = await loadUiState();
    carouselHintSeenCache = state.carouselHintSeen;
    return state.carouselHintSeen;
  } catch {
    return false;
  }
}

export async function setCarouselHintSeen(): Promise<void> {
  try {
    await patchUiState({ carouselHintSeen: true });
    carouselHintSeenCache = true;
  } catch {
    // non-critical
  }
}

export interface SupplementReminderPrefs {
  enabled: boolean;
  timeLabel: string;
}

const SUPPLEMENT_REMINDER_PREFS_KEY = '@moodrx_supplement_reminder_prefs';

export async function getSupplementReminderPrefs(): Promise<SupplementReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(SUPPLEMENT_REMINDER_PREFS_KEY);
    if (!raw) return { enabled: false, timeLabel: '9:00 AM' };
    const parsed = JSON.parse(raw) as Partial<SupplementReminderPrefs>;
    return {
      enabled: parsed.enabled === true,
      timeLabel: typeof parsed.timeLabel === 'string' ? parsed.timeLabel : '9:00 AM',
    };
  } catch (e) {
    console.warn('[MoodRx] getSupplementReminderPrefs failed:', e);
    return { enabled: false, timeLabel: '9:00 AM' };
  }
}

export async function saveSupplementReminderPrefs(prefs: SupplementReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(SUPPLEMENT_REMINDER_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[MoodRx] saveSupplementReminderPrefs failed:', e);
  }
}

const TRASH_TALK_VOLUME_KEY = '@moodrx_trash_talk_volume';
const DEFAULT_TRASH_TALK_VOLUME = 0.7;

export async function getTrashTalkVolume(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TRASH_TALK_VOLUME_KEY);
    if (!raw) return DEFAULT_TRASH_TALK_VOLUME;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return DEFAULT_TRASH_TALK_VOLUME;
    return Math.min(1, Math.max(0, n));
  } catch {
    return DEFAULT_TRASH_TALK_VOLUME;
  }
}

export async function setTrashTalkVolume(volume: number): Promise<void> {
  try {
    const clamped = Math.min(1, Math.max(0, volume));
    await AsyncStorage.setItem(TRASH_TALK_VOLUME_KEY, String(clamped));
  } catch {
    // non-critical
  }
}

const AI_COACH_KEY = '@moodrx_ai_coach_enabled';

/** Opt-in for the dynamic AI coach. Default false — sending mood facts
 *  off-device is a separate consent from the trash-talk toggle. */
export async function getAiCoachEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AI_COACH_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAiCoachEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(AI_COACH_KEY, value ? 'true' : 'false');
}

const VENT_CONSENT_KEY = '@moodrx_vent_consent';
const VENT_ENABLED_KEY = '@moodrx_vent_enabled';

/** One-time first-run consent for voice venting (sending the transcript to the
 *  AI). Gates the first tap on "Need to vent?". */
export async function getVentConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VENT_CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setVentConsent(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VENT_CONSENT_KEY, value ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

/** Settings toggle to disable voice venting after consent (defaults ON once
 *  consent is given — absence of the key is treated as enabled). */
export async function getVentEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VENT_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setVentEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VENT_ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

const VOICE_ENABLED_KEY = '@moodrx_voice_enabled';

export async function getVoiceEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_ENABLED_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export async function setVoiceEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

const WORKOUT_FOCUS_MODE_KEY = '@moodrx_workout_focus_mode';
const WORKOUT_VOICE_MODE_KEY = '@moodrx_workout_voice_mode';

export async function getWorkoutFocusMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WORKOUT_FOCUS_MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setWorkoutFocusMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKOUT_FOCUS_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

export async function getWorkoutVoiceMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WORKOUT_VOICE_MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setWorkoutVoiceMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKOUT_VOICE_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

export async function consumeNavHintPending(): Promise<boolean> {
  try {
    const state = await loadUiState();
    if (state.navHintPending && !state.navHintSeen) return true;
    if (state.navHintPending) {
      await patchUiState({ navHintPending: false });
    }
    return false;
  } catch {
    return false;
  }
}

export async function setNavHintSeen(): Promise<void> {
  try {
    await patchUiState({ navHintSeen: true, navHintPending: false });
  } catch {
    // non-critical
  }
}

const REVIEW_STATE_KEY = '@moodrx_review_state';

export interface ReviewState {
  /** Unix ms of the last time we asked the OS to surface a review prompt,
   *  or null if we never have. Used to throttle so we never nag — see
   *  lib/review.ts. */
  lastRequestedAt: number | null;
}

export async function getReviewState(): Promise<ReviewState> {
  if (reviewStateCache) return reviewStateCache;
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY);
    const parsed: ReviewState = raw
      ? (JSON.parse(raw) as ReviewState)
      : { lastRequestedAt: null };
    reviewStateCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[MoodRx] getReviewState failed:', e);
    return { lastRequestedAt: null };
  }
}

export async function setReviewRequested(timestamp: number): Promise<void> {
  try {
    const state: ReviewState = { lastRequestedAt: timestamp };
    await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
    reviewStateCache = state;
  } catch (e) {
    console.warn('[MoodRx] setReviewRequested failed:', e);
  }
}
