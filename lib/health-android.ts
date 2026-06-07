import { Platform } from 'react-native';
import {
  aggregateRecord,
  ExerciseType,
  getSdkStatus,
  initialize,
  insertRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

const READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
];

const WRITE_PERMISSIONS = [
  { accessType: 'write' as const, recordType: 'ExerciseSession' as const },
];

export function isHealthConnectPlatform(): boolean {
  return Platform.OS === 'android';
}

export async function isHealthConnectReady(): Promise<boolean> {
  if (!isHealthConnectPlatform()) return false;
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return await initialize();
  } catch {
    return false;
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!(await isHealthConnectReady())) return false;
  try {
    const granted = await requestPermission([...READ_PERMISSIONS, ...WRITE_PERMISSIONS]);
    if (granted.length === 0) return false;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    return true;
  } catch (e) {
    console.warn('[MoodRx] Health Connect authorization failed:', e);
    return false;
  }
}

export type HealthReadReason = 'permission' | 'sdk' | 'unknown';

export interface HealthConnectSnapshot {
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
  /** Set when at least one record read FAILED (vs returned no data).
   *  Lets the UI distinguish "nothing logged today" from "we can't read,
   *  user should reconnect Health Connect". Undefined means clean read. */
  readError?: HealthReadReason;
}

/** Best-effort heuristic for the failure mode based on the thrown error.
 *  Health Connect's exception messages aren't structured, but they almost
 *  always include "permission" when scopes were revoked vs. some other
 *  failure mode (SDK not initialized, OS bug, etc.). */
function classifyReadError(e: unknown): HealthReadReason {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  if (msg.includes('permission')) return 'permission';
  if (msg.includes('sdk') || msg.includes('initialize') || msg.includes('not ready')) return 'sdk';
  return 'unknown';
}

export async function readHealthConnectSnapshot(): Promise<HealthConnectSnapshot> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const sleepStart = new Date(now);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0);

  let stepsToday: number | null = null;
  let sleepHoursLastNight: number | null = null;
  // Track the first read error and its classification so the UI can show
  // a "Tap to reconnect Health Connect" hint rather than silently rendering
  // an empty state that looks identical to "no data today".
  let firstError: HealthReadReason | undefined;

  try {
    const stepsResult = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    if (Number.isFinite(stepsResult.COUNT_TOTAL)) {
      stepsToday = Math.round(stepsResult.COUNT_TOTAL);
    }
  } catch (e) {
    console.warn('[MoodRx] Health Connect steps read failed:', e);
    firstError ??= classifyReadError(e);
  }

  try {
    const sleepResult = await aggregateRecord({
      recordType: 'SleepSession',
      timeRangeFilter: {
        operator: 'between',
        startTime: sleepStart.toISOString(),
        endTime: now.toISOString(),
      },
    });
    if (Number.isFinite(sleepResult.SLEEP_DURATION_TOTAL) && sleepResult.SLEEP_DURATION_TOTAL > 0) {
      sleepHoursLastNight = Math.round((sleepResult.SLEEP_DURATION_TOTAL / 3600) * 10) / 10;
    }
  } catch (e) {
    console.warn('[MoodRx] Health Connect sleep read failed:', e);
    firstError ??= classifyReadError(e);
  }

  return { stepsToday, sleepHoursLastNight, readError: firstError };
}

export async function writeHealthConnectExerciseSession(options: {
  title: string;
  startMs: number;
  endMs: number;
  exerciseType: number;
  notes?: string;
}): Promise<void> {
  if (!(await isHealthConnectReady())) return;
  await insertRecords([
    {
      recordType: 'ExerciseSession',
      startTime: new Date(options.startMs).toISOString(),
      endTime: new Date(options.endMs).toISOString(),
      exerciseType: options.exerciseType,
      title: options.title,
      notes: options.notes ?? 'MoodRx',
    },
  ]);
}

export { ExerciseType };
