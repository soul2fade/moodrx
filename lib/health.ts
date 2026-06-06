import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ExerciseType,
  isHealthConnectPlatform,
  isHealthConnectReady,
  readHealthConnectSnapshot,
  requestHealthConnectPermissions,
  writeHealthConnectExerciseSession,
} from './health-android';

const HEALTH_ENABLED_KEY = '@moodrx_health_enabled';

export type HealthPlatform = 'apple' | 'health_connect';

export interface HealthSnapshot {
  connected: boolean;
  available: boolean;
  platform: HealthPlatform | null;
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
}

export interface WorkoutHealthPayload {
  name: string;
  durationMinutes: number;
  startMs: number;
  endMs: number;
}

/** Result of a permission request. HealthKit's privacy design hides
 *  whether read access was actually granted (the API succeeds even for
 *  denied reads), so we surface `mayBeDenied` when the post-auth probe
 *  returns 0 — UI can prompt the user to verify in Settings → Health. */
export interface HealthPermissionResult {
  granted: boolean;
  mayBeDenied?: boolean;
}

/** Structured outcome of a write to HealthKit / Health Connect. Lets
 *  callers log/surface a meaningful reason instead of guessing whether
 *  the silent fire-and-forget actually persisted anything. */
export type HealthWriteReason =
  | 'not_enabled'    // user hasn't opted in to health sync
  | 'invalid_window' // start/end timestamps are NaN, zero, or end <= start
  | 'no_module'      // native module unavailable (Expo Go, missing build)
  | 'write_failed';  // platform SDK threw — see logs for details

export interface HealthWriteResult {
  ok: boolean;
  reason?: HealthWriteReason;
}

type HealthModule = typeof import('@kayzmann/expo-healthkit');

function getHealthKitModule(): HealthModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // Native module — only present after dev-client rebuild with HealthKit plugin
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kayzmann/expo-healthkit') as HealthModule;
  } catch {
    return null;
  }
}

export function getHealthPlatform(): HealthPlatform | null {
  if (Platform.OS === 'ios' && isHealthKitAvailable()) return 'apple';
  if (isHealthConnectPlatform()) return 'health_connect';
  return null;
}

export function getHealthPlatformLabel(platform: HealthPlatform | null = getHealthPlatform()): string {
  if (platform === 'apple') return 'Apple Health';
  if (platform === 'health_connect') return 'Health Connect';
  return 'Health';
}

/** @deprecated Use isHealthSyncAvailable */
export function isHealthKitAvailable(): boolean {
  const mod = getHealthKitModule();
  if (!mod) return false;
  try {
    return mod.isAvailable();
  } catch {
    return false;
  }
}

export function isHealthSyncAvailable(): boolean {
  if (Platform.OS === 'ios') return isHealthKitAvailable();
  if (Platform.OS === 'android') return isHealthConnectPlatform();
  return false;
}

export async function isHealthBackendReady(): Promise<boolean> {
  if (Platform.OS === 'ios') return isHealthKitAvailable();
  if (Platform.OS === 'android') return isHealthConnectReady();
  return false;
}

export async function getHealthSyncEnabled(): Promise<boolean> {
  if (!isHealthSyncAvailable()) return false;
  try {
    return (await AsyncStorage.getItem(HEALTH_ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setHealthSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HEALTH_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // non-critical
  }
}

export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  if (Platform.OS === 'android') {
    const granted = await requestHealthConnectPermissions();
    if (granted) await setHealthSyncEnabled(true);
    else await setHealthSyncEnabled(false);
    return { granted };
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return { granted: false };
  try {
    await mod.requestAuthorization(
      ['Steps', 'SleepAnalysis', 'Workout', 'MindfulMinutes'],
      ['Workout', 'MindfulMinutes'],
    );
    // The auth call resolves whether the user tapped "Allow" or "Don't Allow"
    // (or tapped through a dialog with everything off). Treat that as "the
    // user opted in" — write paths will still work, and read paths surface
    // via mayBeDenied below.
    await setHealthSyncEnabled(true);
    // HealthKit privacy: reads silently return 0 / empty when scopes are
    // denied (Apple intentionally hides this from apps). We probe steps for
    // today; if the result is exactly 0, flag mayBeDenied so the UI can
    // prompt the user to verify Settings → Health → Sources → MoodRx.
    // (Note: a user genuinely at 0 steps today will see the hint too. The
    // false-positive cost is small compared to "silently shows 0 forever".)
    let mayBeDenied = false;
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const steps = await mod.getSteps(startOfDay, now);
      if (!Number.isFinite(steps) || steps === 0) {
        mayBeDenied = true;
      }
    } catch {
      // Probe itself failed — treat as denied, but don't tear down the opt-in.
      mayBeDenied = true;
    }
    return { granted: true, mayBeDenied };
  } catch (e) {
    await setHealthSyncEnabled(false);
    console.warn('[MoodRx] HealthKit authorization failed:', e);
    return { granted: false };
  }
}

export async function clearHealthSyncPref(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HEALTH_ENABLED_KEY);
  } catch {
    // non-critical
  }
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const platform = getHealthPlatform();
  const available = platform !== null;
  const connected = available && (await getHealthSyncEnabled());

  if (!connected || !platform) {
    return {
      connected: false,
      available,
      platform,
      stepsToday: null,
      sleepHoursLastNight: null,
    };
  }

  if (platform === 'health_connect') {
    try {
      const { stepsToday, sleepHoursLastNight } = await readHealthConnectSnapshot();
      return {
        connected: true,
        available: true,
        platform,
        stepsToday,
        sleepHoursLastNight,
      };
    } catch (e) {
      console.warn('[MoodRx] getHealthSnapshot (Health Connect) failed:', e);
      return {
        connected: true,
        available: true,
        platform,
        stepsToday: null,
        sleepHoursLastNight: null,
      };
    }
  }

  const mod = getHealthKitModule();
  if (!mod) {
    return {
      connected: false,
      available,
      platform,
      stepsToday: null,
      sleepHoursLastNight: null,
    };
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const stepsToday = await mod.getSteps(startOfDay, now);

    const sleepStart = new Date(now);
    sleepStart.setDate(sleepStart.getDate() - 1);
    sleepStart.setHours(18, 0, 0, 0);
    const sleepSamples = await mod.getSleepSamples(sleepStart, now);
    const asleepSeconds = sleepSamples
      .filter((s) => ['asleep', 'core', 'deep', 'rem'].includes(s.value))
      .reduce((sum, s) => sum + (s.duration ?? 0), 0);

    return {
      connected: true,
      available: true,
      platform,
      stepsToday: Number.isFinite(stepsToday) ? Math.round(stepsToday) : null,
      sleepHoursLastNight: asleepSeconds > 0 ? Math.round((asleepSeconds / 3600) * 10) / 10 : null,
    };
  } catch (e) {
    console.warn('[MoodRx] getHealthSnapshot (HealthKit) failed:', e);
    return {
      connected: true,
      available: true,
      platform,
      stepsToday: null,
      sleepHoursLastNight: null,
    };
  }
}

export async function saveWorkoutToHealth(payload: WorkoutHealthPayload): Promise<HealthWriteResult> {
  if (!(await getHealthSyncEnabled())) return { ok: false, reason: 'not_enabled' };

  // Use the caller's actual measured window. Previously we back-computed
  // startMs from `endMs - max(60s, durationMinutes*60)`, which clobbered
  // payload.startMs and produced overlapping samples on back-to-back
  // sessions (next session's clamped 60s window stomped on prior end).
  const { startMs, endMs, name } = payload;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    console.warn('[MoodRx] saveWorkoutToHealth skipped — invalid window', { startMs, endMs });
    return { ok: false, reason: 'invalid_window' };
  }
  const durationSec = Math.round((endMs - startMs) / 1000);

  if (Platform.OS === 'android') {
    try {
      await writeHealthConnectExerciseSession({
        title: name,
        startMs,
        endMs,
        exerciseType: ExerciseType.OTHER_WORKOUT,
      });
      return { ok: true };
    } catch (e) {
      console.warn('[MoodRx] saveWorkoutToHealth (Health Connect) failed:', e);
      return { ok: false, reason: 'write_failed' };
    }
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return { ok: false, reason: 'no_module' };

  try {
    await mod.saveWorkout({
      startDate: startMs / 1000,
      endDate: endMs / 1000,
      duration: durationSec,
      distance: 0,
      calories: 0,
      activityType: 'other',
      metadata: { name, source: 'MoodRx' },
    });
    return { ok: true };
  } catch (e) {
    console.warn('[MoodRx] saveWorkoutToHealth (HealthKit) failed:', e);
    return { ok: false, reason: 'write_failed' };
  }
}

/** Box-breathing cycles — 16 seconds per full 4-4-4-4 cycle. */
export async function saveMindfulMinutesToHealth(cycles: number): Promise<HealthWriteResult> {
  if (cycles <= 0) return { ok: false, reason: 'invalid_window' };
  if (!(await getHealthSyncEnabled())) return { ok: false, reason: 'not_enabled' };

  const durationSec = Math.max(60, cycles * 16);
  const endMs = Date.now();
  const startMs = endMs - durationSec * 1000;

  if (Platform.OS === 'android') {
    try {
      await writeHealthConnectExerciseSession({
        title: 'MoodRx Box Breathing',
        startMs,
        endMs,
        exerciseType: ExerciseType.GUIDED_BREATHING,
        notes: 'Mindful breathing session',
      });
      return { ok: true };
    } catch (e) {
      console.warn('[MoodRx] saveMindfulMinutesToHealth (Health Connect) failed:', e);
      return { ok: false, reason: 'write_failed' };
    }
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return { ok: false, reason: 'no_module' };

  try {
    // HealthKit mindful sessions require category samples; yoga is the closest supported write type.
    await mod.saveWorkout({
      startDate: startMs / 1000,
      endDate: endMs / 1000,
      duration: durationSec,
      distance: 0,
      calories: 0,
      activityType: 'yoga',
      metadata: { name: 'MoodRx Box Breathing', source: 'MoodRx', mindful: true },
    });
    return { ok: true };
  } catch (e) {
    console.warn('[MoodRx] saveMindfulMinutesToHealth (HealthKit) failed:', e);
    return { ok: false, reason: 'write_failed' };
  }
}
