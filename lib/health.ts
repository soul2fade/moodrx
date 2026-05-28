import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTH_ENABLED_KEY = '@moodrx_health_enabled';

export interface HealthSnapshot {
  connected: boolean;
  available: boolean;
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

function getHealthModule(): HealthModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // Native module — only present after dev-client rebuild with HealthKit plugin
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kayzmann/expo-healthkit') as HealthModule;
  } catch {
    return null;
  }
}

export function isHealthKitAvailable(): boolean {
  const mod = getHealthModule();
  if (!mod) return false;
  try {
    return mod.isAvailable();
  } catch {
    return false;
  }
}

export async function getHealthSyncEnabled(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
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
  const mod = getHealthModule();
  if (!mod?.isAvailable()) return false;
  try {
    await mod.requestAuthorization(
      ['Steps', 'SleepAnalysis', 'Workout'],
      ['Workout'],
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
  const available = isHealthKitAvailable();
  const connected = available && (await getHealthSyncEnabled());
  if (!connected) {
    return { connected: false, available, stepsToday: null, sleepHoursLastNight: null };
  }

  const mod = getHealthModule();
  if (!mod) {
    return { connected: false, available, stepsToday: null, sleepHoursLastNight: null };
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
      stepsToday: Number.isFinite(stepsToday) ? Math.round(stepsToday) : null,
      sleepHoursLastNight: asleepSeconds > 0 ? Math.round((asleepSeconds / 3600) * 10) / 10 : null,
    };
  } catch (e) {
    console.warn('[MoodRx] getHealthSnapshot failed:', e);
    return { connected: true, available: true, stepsToday: null, sleepHoursLastNight: null };
  }
}

export async function saveWorkoutToHealth(payload: WorkoutHealthPayload): Promise<void> {
  if (!(await getHealthSyncEnabled())) return;
  const mod = getHealthModule();
  if (!mod?.isAvailable()) return;

  const durationSec = Math.max(60, Math.round(payload.durationMinutes * 60));
  const endSec = payload.endMs / 1000;
  const startSec = endSec - durationSec;

  try {
    await mod.saveWorkout({
      startDate: startSec,
      endDate: endSec,
      duration: durationSec,
      distance: 0,
      calories: 0,
      activityType: 'other',
      metadata: { name: payload.name, source: 'MoodRx' },
    });
  } catch (e) {
    console.warn('[MoodRx] saveWorkoutToHealth failed:', e);
  }
}

/** Box-breathing cycles — 16 seconds per full 4-4-4-4 cycle. */
export async function saveMindfulMinutesToHealth(cycles: number): Promise<void> {
  if (cycles <= 0) return;
  if (!(await getHealthSyncEnabled())) return;
  const mod = getHealthModule();
  if (!mod?.isAvailable()) return;

  const durationSec = Math.max(60, cycles * 16);
  const endSec = Date.now() / 1000;
  const startSec = endSec - durationSec;

  try {
    await mod.saveWorkout({
      startDate: startSec,
      endDate: endSec,
      duration: durationSec,
      distance: 0,
      calories: 0,
      activityType: 'yoga',
      metadata: { name: 'MoodRx Box Breathing', source: 'MoodRx' },
    });
  } catch (e) {
    console.warn('[MoodRx] saveMindfulMinutesToHealth failed:', e);
  }
}
