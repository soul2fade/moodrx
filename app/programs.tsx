import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROGRAMS, getProgramWorkouts, type Program } from '@/lib/programs';
import { type Workout } from '@/lib/workouts';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PremiumSheet } from '@/components/PremiumSheet';
import { type as t, fonts } from '../lib/typography';
import { colors } from '@/lib/colors';

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium } = useSubscription();
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 56) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back to insights"
        >
          <Text style={styles.backButton}>← INSIGHTS</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.pageLabel}>PROGRAMS</Text>
        <Text style={styles.headline}>Curated sequences.</Text>
        <Text style={styles.subtext}>Multi-day prescriptions built from existing workouts. Follow one start to finish.</Text>

        {!isPremium ? (
          /* Safety-net locked state */
          <View style={styles.lockedState}>
            <Text style={styles.lockedText}>Programs are included with your base unlock.</Text>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => setShowPremiumSheet(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Unlock programs"
            >
              <Text style={styles.unlockBtnText}>UNLOCK →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          PROGRAMS.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))
        )}
      </ScrollView>

      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
      />
    </View>
  );
}

function ProgramCard({ program }: { program: Program }) {
  const workouts = getProgramWorkouts(program);

  return (
    <View style={styles.programCard}>
      <Text style={styles.programTitle}>{program.title}</Text>
      <Text style={styles.programDescription}>{program.description}</Text>
      <View style={styles.sessionList}>
        {workouts.map((workout, index) => (
          <SessionRow
            key={workout.id}
            workout={workout}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}

function SessionRow({ workout, index }: { workout: Workout; index: number }) {
  return (
    <TouchableOpacity
      style={styles.sessionRow}
      onPress={() =>
        router.push({
          pathname: '/workout',
          params: { mood: workout.mood, workoutId: workout.id, intensity: '5' },
        })
      }
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Day ${index + 1}: ${workout.name}, ${workout.duration} minutes, ${workout.intensity}`}
    >
      <Text style={styles.sessionDay}>DAY {index + 1}</Text>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{workout.name}</Text>
        <View style={styles.sessionMeta}>
          <Text style={styles.sessionMetaText}>{workout.duration} MIN</Text>
          <Text style={styles.sessionMetaDot}>·</Text>
          <Text style={styles.sessionMetaText}>{workout.intensity.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.sessionArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  backButton: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
  },
  pageLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    fontFamily: fonts.primary.bold,
    fontSize: 27,
    color: '#ffffff',
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: 8,
  },
  subtext: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#e2e2e2',
    lineHeight: 24,
    marginTop: 4,
    marginBottom: 8,
  },
  lockedState: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 24,
    marginTop: 32,
    alignItems: 'center',
    gap: 16,
  },
  lockedText: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#d8d8d8',
    textAlign: 'center',
    lineHeight: 24,
  },
  unlockBtn: {
    borderWidth: 1,
    borderColor: colors.textDim,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  unlockBtnText: {
    ...t.label,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  programCard: {
    marginTop: 32,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
  },
  programTitle: {
    fontFamily: fonts.primary.bold,
    fontSize: 22,
    color: '#ffffff',
    lineHeight: 28,
  },
  programDescription: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#d8d8d8',
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 16,
  },
  sessionList: {
    gap: 0,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sessionDay: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    lineHeight: 17,
    width: 44,
    textTransform: 'uppercase',
  },
  sessionInfo: {
    flex: 1,
    marginLeft: 8,
  },
  sessionName: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#e8e8e8',
    lineHeight: 22,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  sessionMetaText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  sessionMetaDot: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    lineHeight: 17,
  },
  sessionArrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    marginLeft: 8,
  },
});
