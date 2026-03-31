import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { type as t, fonts } from '../lib/typography';

interface BreakthroughCardProps {
  mood: MoodKey;
  intensity: number;
  postScore: number;
  workoutName: string;
}

export function BreakthroughCard({ mood, intensity, postScore, workoutName }: BreakthroughCardProps) {
  const moodData = MOODS[mood];
  const delta = postScore - intensity;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaColor = delta >= 0 ? '#059669' : '#c8c8c8';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.appName}>MOODRX</Text>
        <Text style={styles.tag}>MOOD LOG</Text>
      </View>

      <View style={[styles.accentBar, { backgroundColor: moodData.color }]} />

      <View style={styles.moodRow}>
        <Text style={[styles.moodName, { color: moodData.color }]}>
          {moodData.name.toUpperCase()}
        </Text>
      </View>

      <View style={styles.numbersRow}>
        <View style={styles.numberBlock}>
          <Text style={styles.numberLabel}>BEFORE</Text>
          <Text style={styles.numberValue}>{intensity}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.numberBlock}>
          <Text style={styles.numberLabel}>AFTER</Text>
          <Text style={[styles.numberValue, { color: moodData.color }]}>{postScore}</Text>
        </View>
        <View style={[styles.numberBlock, styles.deltaBlock]}>
          <Text style={styles.numberLabel}>CHANGE</Text>
          <Text style={[styles.deltaValue, { color: deltaColor }]}>{deltaStr}</Text>
        </View>
      </View>

      <View style={styles.workoutRow}>
        <Text style={styles.workoutLabel}>VIA</Text>
        <Text style={styles.workoutName}>{workoutName}</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.watermark}>moodrx.app  ·  move for your mind</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  appName: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 4,
    fontSize: 11,
  },
  tag: {
    ...t.label,
    color: '#525252',
    letterSpacing: 2,
    fontSize: 9,
  },
  accentBar: {
    height: 2,
    width: '100%',
    marginBottom: 16,
  },
  moodRow: {
    marginBottom: 20,
  },
  moodName: {
    fontSize: 38,
    fontWeight: '700',
    fontFamily: fonts.primary.bold,
    letterSpacing: 1,
    lineHeight: 40,
  },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  numberBlock: {
    flex: 1,
    alignItems: 'center',
  },
  deltaBlock: {
    borderLeftWidth: 1,
    borderLeftColor: '#1a1a1a',
  },
  numberLabel: {
    ...t.label,
    color: '#525252',
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 4,
  },
  numberValue: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.mono.regular,
    color: '#c8c8c8',
  },
  deltaValue: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.mono.regular,
  },
  arrow: {
    color: '#333333',
    fontSize: 16,
    marginHorizontal: 4,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  workoutLabel: {
    ...t.label,
    color: '#525252',
    letterSpacing: 2,
    fontSize: 9,
  },
  workoutName: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 1,
    fontSize: 11,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  watermark: {
    ...t.label,
    color: '#333333',
    letterSpacing: 2,
    fontSize: 9,
  },
});
