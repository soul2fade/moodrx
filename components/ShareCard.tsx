import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Session } from '@/lib/storage';
import type { MoodKey } from '@/lib/storage';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { type as t } from '../lib/typography';

interface ShareCardProps {
  sessions: Session[];
  streak: number;
  avgChange: number;
}

function getMostCommonMood(sessions: Session[]): MoodKey {
  const counts: Partial<Record<MoodKey, number>> = {};
  for (const s of sessions) {
    counts[s.mood] = (counts[s.mood] ?? 0) + 1;
  }
  let max = 0;
  let best: MoodKey = 'anxious';
  for (const key of MOOD_ORDER) {
    const c = counts[key] ?? 0;
    if (c > max) {
      max = c;
      best = key;
    }
  }
  return best;
}

function formatChange(val: number): string {
  const rounded = Math.abs(val).toFixed(1);
  return val >= 0 ? `+${rounded}` : `-${rounded}`;
}

export function ShareCard({ sessions, streak, avgChange }: ShareCardProps) {
  const sessionCount = sessions.length;
  const mostCommonMood = sessionCount > 0 ? getMostCommonMood(sessions) : null;
  const moodName = mostCommonMood ? MOODS[mostCommonMood].name : '—';

  return (
    <View style={styles.card}>
      <Text style={styles.appName}>MOODRX</Text>
      <Text style={styles.tagline}>Move for your mind.</Text>
      <View style={styles.divider} />
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#5EAAB5' }]}>{sessionCount}</Text>
          <Text style={styles.statLabel}>SESSIONS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#059669' }]}>{formatChange(avgChange)}</Text>
          <Text style={styles.statLabel}>AVG CHANGE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#D97706' }]}>{streak}</Text>
          <Text style={styles.statLabel}>DAY STREAK</Text>
        </View>
      </View>
      {mostCommonMood && (
        <View style={styles.moodSection}>
          <Text style={styles.moodName}>{moodName}</Text>
          <Text style={styles.moodLabel}>MOST COMMON MOOD</Text>
        </View>
      )}
      <Text style={styles.watermark}>moodrx.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 24,
    borderRadius: 0,
  },
  appName: {
    ...t.labelBright,
    letterSpacing: 4,
  },
  tagline: {
    ...t.bodyMuted,
    color: '#737373',
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1a1a1a',
  },
  statNumber: {
    ...t.dataValue,
    fontSize: 24,
  },
  statLabel: {
    ...t.dataLabel,
    color: '#737373',
    letterSpacing: 2,
    marginTop: 4,
  },
  moodSection: {
    marginTop: 16,
  },
  moodName: {
    ...t.headline,
    fontSize: 28,
  },
  moodLabel: {
    ...t.dataLabel,
    color: '#737373',
    letterSpacing: 2,
    marginTop: 4,
  },
  watermark: {
    ...t.label,
    color: '#737373',
    letterSpacing: 3,
    marginTop: 24,
  },
});