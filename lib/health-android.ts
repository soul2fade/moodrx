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

export async function readHealthConnectSnapshot(): Promise<{
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
}> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const sleepStart = new Date(now);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0);

  let stepsToday: number | null = null;
  let sleepHoursLastNight: number | null = null;

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
  }

  return { stepsToday, sleepHoursLastNight };
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
