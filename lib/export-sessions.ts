import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Session } from '@/lib/storage';

export async function exportSessionsJson(sessions: Session[]): Promise<void> {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    sessionCount: sessions.length,
    sessions,
  };
  const filename = `moodrx-sessions-${Date.now()}.json`;
  const path = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(path, JSON.stringify(payload, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Export MoodRx sessions',
  });
}
