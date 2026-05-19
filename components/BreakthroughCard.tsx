import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { fonts } from '../lib/typography';

interface BreakthroughCardProps {
  mood: MoodKey;
  intensity: number;
  postScore: number;
  workoutName: string;
  duration?: number;
  streak?: number;
}

function formatDate(): string {
  const d = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

function getDeltaLabel(displayed: number): string {
  if (displayed >= 5) return 'SIGNIFICANT IMPROVEMENT';
  if (displayed >= 3) return 'NOTABLE IMPROVEMENT';
  if (displayed >= 1) return 'MILD IMPROVEMENT';
  if (displayed === 0) return 'STABLE';
  return 'UNDER OBSERVATION';
}

export function BreakthroughCard({
  mood,
  intensity,
  postScore,
  workoutName,
  duration,
  streak,
}: BreakthroughCardProps) {
  const moodData = MOODS[mood];
  const lowerIsBetter = mood !== 'good';
  const raw = postScore - intensity;
  const displayed = lowerIsBetter ? -raw : raw;
  const deltaStr = displayed > 0 ? `+${displayed}` : `${displayed}`;
  const deltaColor = displayed >= 2 ? '#059669' : displayed >= 0 ? '#888888' : '#c8c8c8';
  const statusColor = displayed >= 1 ? '#059669' : '#888888';
  const status = displayed >= 1 ? 'TREATED' : 'LOGGED';

  return (
    <View style={styles.card}>
      <View style={[styles.topBar, { backgroundColor: moodData.color }]} />

      <View style={styles.header}>
        <Text style={styles.appName}>MOODRX</Text>
        <View style={styles.headerRight}>
          <Text style={styles.dateText}>{formatDate()}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.diagnosisBlock}>
        <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
        <Text style={[styles.moodName, { color: moodData.color }]}>
          {moodData.name.toUpperCase()}
        </Text>
        <Text style={styles.moodDescription}>{moodData.description}</Text>
      </View>

      <View style={styles.heroBlock}>
        <Text style={[styles.deltaHero, { color: deltaColor }]}>{deltaStr}</Text>
        <Text style={styles.deltaHeroLabel}>{getDeltaLabel(displayed)}</Text>
      </View>

      <View style={styles.numbersGrid}>
        <View style={styles.numCell}>
          <Text style={styles.numLabel}>PRE</Text>
          <Text style={styles.numValue}>{intensity}</Text>
        </View>
        <View style={styles.numSep}>
          <Text style={styles.numSepText}>→</Text>
        </View>
        <View style={styles.numCell}>
          <Text style={styles.numLabel}>POST</Text>
          <Text style={[styles.numValue, { color: moodData.color }]}>{postScore}</Text>
        </View>
        <View style={[styles.numCell, styles.numCellBordered]}>
          <Text style={styles.numLabel}>CHANGE</Text>
          <Text style={[styles.numValue, { color: deltaColor }]}>{deltaStr}</Text>
        </View>
      </View>

      <View style={styles.treatmentBlock}>
        <View style={styles.treatmentRow}>
          <Text style={styles.treatmentLabel}>TREATMENT</Text>
          <Text style={styles.treatmentValue} numberOfLines={1}>
            {workoutName}{duration ? `  ·  ${duration} MIN` : ''}
          </Text>
        </View>
        {streak !== undefined && streak > 0 && (
          <View style={styles.treatmentRow}>
            <Text style={styles.treatmentLabel}>STREAK</Text>
            <Text style={styles.treatmentValue}>
              {streak} {streak === 1 ? 'DAY' : 'DAYS'} STRAIGHT
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={[styles.footerBar, { backgroundColor: moodData.color }]} />
        <Text style={styles.watermark}>moodrx.app  ·  move for your mind</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#1c1c1c',
    overflow: 'hidden',
  },
  topBar: {
    height: 4,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
  },
  appName: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 5,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  dateText: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    letterSpacing: 2,
  },
  diagnosisBlock: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 4,
  },
  diagnosisLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    color: '#c8c8c8',
    letterSpacing: 4,
    marginBottom: 6,
  },
  moodName: {
    fontFamily: fonts.primary.bold,
    fontSize: 46,
    letterSpacing: -1,
    lineHeight: 48,
  },
  moodDescription: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#c8c8c8',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  heroBlock: {
    alignItems: 'center',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#131313',
    marginTop: 24,
    marginHorizontal: 24,
  },
  deltaHero: {
    fontFamily: fonts.mono.regular,
    fontSize: 80,
    lineHeight: 84,
    letterSpacing: -2,
  },
  deltaHeroLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    color: '#c8c8c8',
    letterSpacing: 4,
    marginTop: 8,
  },
  numbersGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#131313',
    paddingVertical: 14,
  },
  numCell: {
    flex: 1,
    alignItems: 'center',
  },
  numCellBordered: {
    borderLeftWidth: 1,
    borderLeftColor: '#131313',
  },
  numSep: {
    paddingHorizontal: 4,
  },
  numSepText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#c8c8c8',
  },
  numLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 7,
    color: '#c8c8c8',
    letterSpacing: 2,
    marginBottom: 5,
  },
  numValue: {
    fontFamily: fonts.mono.regular,
    fontSize: 26,
    color: '#c8c8c8',
  },
  treatmentBlock: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 10,
  },
  treatmentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'baseline',
  },
  treatmentLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 7,
    color: '#c8c8c8',
    letterSpacing: 3,
    width: 70,
    flexShrink: 0,
  },
  treatmentValue: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#c8c8c8',
    letterSpacing: 0.5,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  footerBar: {
    height: 1,
    opacity: 0.25,
  },
  watermark: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    color: '#666666',
    letterSpacing: 2,
  },
});
