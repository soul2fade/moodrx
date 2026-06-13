import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import {
  formatSessionDelta,
  getWinMessage,
  isMoodImprovement,
} from '@/lib/session-utils';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

interface SessionWinCardProps {
  visible: boolean;
  mood: MoodKey;
  intensity: number;
  postScore: number;
  workoutName: string;
  isFirstSession?: boolean;
  onViewEvidence: () => void;
  onDone: () => void;
}

export function SessionWinCard({
  visible,
  mood,
  intensity,
  postScore,
  workoutName,
  isFirstSession,
  onViewEvidence,
  onDone,
}: SessionWinCardProps) {
  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const improved = isMoodImprovement(intensity, postScore);
  const deltaLabel = formatSessionDelta(intensity, postScore);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.overlay} onPress={onDone} accessibilityLabel="Dismiss" />
      <View style={styles.sheet}>
        <Text style={styles.label}>
          {isFirstSession ? 'SESSION #1 LOGGED' : 'EVIDENCE CAPTURED'}
        </Text>
        <Text style={styles.headline}>
          {isFirstSession ? 'Your evidence file is open.' : 'You moved the needle.'}
        </Text>

        <View style={[styles.deltaCard, { borderColor: accentColor }]}>
          <Text style={styles.deltaLabel}>BEFORE → AFTER</Text>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaScore}>{intensity}</Text>
            <Text style={[styles.deltaArrow, { color: accentColor }]}>→</Text>
            <Text style={[styles.deltaScore, { color: accentColor }]}>{postScore}</Text>
          </View>
          <Text style={[styles.deltaChange, { color: improved ? '#22c55e' : '#c8c8c8' }]}>
            {deltaLabel} · {MOODS[mood].name.toUpperCase()}
          </Text>
          <Text style={styles.winMessage}>{getWinMessage(intensity, postScore)}</Text>
        </View>

        <Text style={styles.workoutLine}>{workoutName}</Text>

        {isFirstSession && (
          <Text style={styles.firstHint}>
            MoodRx tracks what actually works for your brain. This is how it starts.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { borderColor: accentColor }]}
          onPress={onViewEvidence}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="View evidence and insights"
        >
          <Text style={[styles.primaryBtnText, { color: accentColor }]}>VIEW EVIDENCE →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onDone}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text style={styles.secondaryBtnText}>
            {isFirstSession ? 'BACK TO CHECK-IN' : 'DONE'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  label: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 3,
    textAlign: 'center',
  },
  headline: {
    ...t.headlineSm,
    fontSize: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  deltaCard: {
    borderWidth: 1,
    backgroundColor: '#0a0a0a',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deltaLabel: {
    ...t.label,
    color: '#d8d8d8',
    letterSpacing: 3,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
    gap: 16,
  },
  deltaScore: {
    ...t.dataValue,
    fontSize: 48,
  },
  deltaArrow: {
    fontSize: 28,
    fontWeight: '300',
  },
  deltaChange: {
    ...t.label,
    letterSpacing: 2,
    marginTop: 8,
  },
  winMessage: {
    ...t.bodyMuted,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  workoutLine: {
    ...t.bodySm,
    color: '#cdcdcd',
    textAlign: 'center',
    marginTop: 16,
  },
  firstHint: {
    ...t.softMuted,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 15,
  },
  primaryBtn: {
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnText: {
    ...t.button,
    letterSpacing: 3,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryBtnText: {
    ...t.label,
    color: '#cdcdcd',
    letterSpacing: 2,
  },
});
