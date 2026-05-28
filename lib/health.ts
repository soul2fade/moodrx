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

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await requestHealthConnectPermissions();
    if (granted) await setHealthSyncEnabled(true);
    else await setHealthSyncEnabled(false);
    return granted;
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return false;
  try {
    await mod.requestAuthorization(
      ['Steps', 'SleepAnalysis', 'Workout', 'MindfulMinutes'],
      ['Workout', 'MindfulMinutes'],
    );
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    await mod.getSteps(startOfDay, now);
    await setHealthSyncEnabled(true);
    return true;
  } catch (e) {
    await setHealthSyncEnabled(false);
    console.warn('[MoodRx] HealthKit authorization failed:', e);
    return false;
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

export async function saveWorkoutToHealth(payload: WorkoutHealthPayload): Promise<void> {
  if (!(await getHealthSyncEnabled())) return;

  const durationSec = Math.max(60, Math.round(payload.durationMinutes * 60));
  const endMs = payload.endMs;
  const startMs = endMs - durationSec * 1000;

  if (Platform.OS === 'android') {
    try {
      await writeHealthConnectExerciseSession({
        title: payload.name,
        startMs,
        endMs,
        exerciseType: ExerciseType.OTHER_WORKOUT,
      });
    } catch (e) {
      console.warn('[MoodRx] saveWorkoutToHealth (Health Connect) failed:', e);
    }
    return;
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return;

  try {
    await mod.saveWorkout({
      startDate: startMs / 1000,
      endDate: endMs / 1000,
      duration: durationSec,
      distance: 0,
      calories: 0,
      activityType: 'other',
      metadata: { name: payload.name, source: 'MoodRx' },
    });
  } catch (e) {
    console.warn('[MoodRx] saveWorkoutToHealth (HealthKit) failed:', e);
  }
}

/** Box-breathing cycles — 16 seconds per full 4-4-4-4 cycle. */
export async function saveMindfulMinutesToHealth(cycles: number): Promise<void> {
  if (cycles <= 0) return;
  if (!(await getHealthSyncEnabled())) return;

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
    } catch (e) {
      console.warn('[MoodRx] saveMindfulMinutesToHealth (Health Connect) failed:', e);
    }
    return;
  }

  const mod = getHealthKitModule();
  if (!mod?.isAvailable()) return;

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
  } catch (e) {
    console.warn('[MoodRx] saveMindfulMinutesToHealth (HealthKit) failed:', e);
  }
}
