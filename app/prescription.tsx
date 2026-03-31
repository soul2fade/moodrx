import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutsForMood, Workout } from '@/lib/workouts';
import { getSupplementsForMood } from '@/lib/supplements';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t } from '../lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PremiumSheet } from '@/components/PremiumSheet';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

type Tab = 'workouts' | 'stack';

export default function PrescriptionScreen() {
  const params = useLocalSearchParams<{ mood: string; intensity: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const intensity = parseInt(params.intensity || '5', 10);
  const [activeTab, setActiveTab] = useState<Tab>('workouts');
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const { isPremium } = useSubscription();

  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const workouts = getWorkoutsForMood(mood);
  const supplements = getSupplementsForMood(mood);

  const handleWorkoutTap = (workout: Workout) => {
    router.push({
      pathname: '/workout',
      params: { mood, workoutId: workout.id, intensity: String(intensity) },
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'workouts', label: 'WORKOUTS' },
    { key: 'stack', label: 'STACK' },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Fixed header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← CHANGE MY MIND</Text>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View style={styles.iconCenter}>
            <MoodIcon mood={mood} size={40} color={accentColor} />
          </View>
          <Text style={styles.prescriptionLabel}>YOUR PRESCRIPTION</Text>
          <Text style={styles.prescriptionTitle}>Dr. MoodRx recommends the following.</Text>
          <Text style={styles.prescriptionSub}>Don&apos;t argue.</Text>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={isSelected
                  ? flattenStyle([styles.tab, { borderBottomWidth: 2, borderBottomColor: accentColor }])
                  : styles.tab}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={tab.label}
              >
                <Text
                  style={isSelected
                    ? { ...t.labelBright, letterSpacing: 2 }
                    : { ...styles.tabText, color: '#a3a3a3' }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tab content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'workouts' && workouts.length > 0 && (
          <View>
            {/* Hero workout — today's prescription */}
            <Text style={[styles.heroRxLabel, { color: accentColor }]}>TODAY&apos;S PRESCRIPTION</Text>
            <TouchableOpacity
              style={flattenStyle([styles.workoutCard, styles.heroCard, { borderLeftWidth: 3, borderLeftColor: accentColor }])}
              onPress={() => handleWorkoutTap(workouts[0])}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Start ${workouts[0].name}`}
            >
              <View style={styles.workoutCardTop}>
                <Text style={flattenStyle([styles.workoutNumber, { color: accentColor }])}>01</Text>
                <View style={styles.workoutCardRight}>
                  <Text style={styles.workoutDuration}>{workouts[0].duration} MIN</Text>
                  <View style={styles.intensityBadge}>
                    <Text style={styles.intensityBadgeText}>{workouts[0].intensity.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.workoutNameRow}>
                <Text style={flattenStyle([styles.workoutName, { flex: 1, fontSize: 20 }])}>{workouts[0].name}</Text>
                <Text style={flattenStyle([styles.workoutArrow, { color: accentColor }])}>→</Text>
              </View>
              <Text style={styles.workoutVibe}>{workouts[0].vibe}</Text>
              <View style={styles.scienceInline}>
                <Text style={flattenStyle([styles.scienceInlineLabel, { color: accentColor }])}>THE SCIENCE</Text>
                <Text style={styles.scienceInlineText}>{workouts[0].why}</Text>
              </View>
              <View style={[styles.startButton, { borderColor: accentColor }]}>
                <Text style={[styles.startButtonText, { color: accentColor }]}>START THIS WORKOUT →</Text>
              </View>
            </TouchableOpacity>

            {/* Alternatives toggle */}
            {workouts.length > 1 && (
              <>
                <TouchableOpacity
                  style={styles.alternativesToggle}
                  onPress={() => setShowAlternatives(v => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showAlternatives ? 'Hide alternatives' : `Show ${workouts.length - 1} alternative workouts`}
                >
                  <Text style={styles.alternativesLabel}>
                    ALTERNATIVES ({workouts.length - 1})
                  </Text>
                  <Text style={styles.alternativesArrow}>{showAlternatives ? '↑' : '↓'}</Text>
                </TouchableOpacity>

                {showAlternatives && workouts.slice(1).map((workout, idx) => {
                  const index = idx + 1;
                  const isLocked = !isPremium;
                  if (isLocked) {
                    return (
                      <TouchableOpacity
                        key={workout.id}
                        style={flattenStyle([styles.workoutCard, { borderLeftWidth: 3, borderLeftColor: '#333333', opacity: 0.7 }])}
                        onPress={() => setShowPremiumSheet(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Unlock ${workout.name} with Pro`}
                      >
                        <View style={styles.workoutCardTop}>
                          <Text style={styles.workoutNumber}>{String(index + 1).padStart(2, '0')}</Text>
                          <View style={styles.workoutCardRight}>
                            <Text style={styles.workoutDuration}>{workout.duration} MIN</Text>
                            <View style={styles.intensityBadge}>
                              <Text style={styles.intensityBadgeText}>{workout.intensity.toUpperCase()}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.workoutNameRow}>
                          <Text style={flattenStyle([styles.workoutName, { flex: 1 }])}>{workout.name}</Text>
                          <Text style={{ ...t.label, color: '#737373', letterSpacing: 2 }}>UNLOCK PRO →</Text>
                        </View>
                        <Text style={styles.workoutVibe}>{workout.vibe}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={workout.id}
                      style={flattenStyle([styles.workoutCard, { borderLeftWidth: 3, borderLeftColor: accentColor }])}
                      onPress={() => handleWorkoutTap(workout)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${workout.name} workout`}
                    >
                      <View style={styles.workoutCardTop}>
                        <Text style={flattenStyle([styles.workoutNumber, { color: accentColor }])}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                        <View style={styles.workoutCardRight}>
                          <Text style={styles.workoutDuration}>{workout.duration} MIN</Text>
                          <View style={styles.intensityBadge}>
                            <Text style={styles.intensityBadgeText}>{workout.intensity.toUpperCase()}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.workoutNameRow}>
                        <Text style={flattenStyle([styles.workoutName, { flex: 1 }])}>{workout.name}</Text>
                        <Text style={flattenStyle([styles.workoutArrow, { color: accentColor }])}>→</Text>
                      </View>
                      <Text style={styles.workoutVibe}>{workout.vibe}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}

        {activeTab === 'stack' && (
          <View>
            <Text style={styles.stackTitle}>Supplements that actually do something.</Text>
            <Text style={styles.stackSub}>According to science, not Instagram.</Text>

            <View style={styles.supplementList}>
              {supplements.map((supp, index) => {
                const isLocked = !isPremium && index > 0;
                if (isLocked) {
                  return (
                    <TouchableOpacity
                      key={supp.name}
                      onPress={() => setShowPremiumSheet(true)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`${supp.name}, locked. Unlock with Pro.`}
                      style={index < supplements.length - 1
                        ? flattenStyle([styles.supplementRow, styles.supplementBorder, { opacity: 0.35 }])
                        : flattenStyle([styles.supplementRow, { opacity: 0.35 }])}
                    >
                      <View style={styles.supplementLeft}>
                        <View style={styles.supplementNameRow}>
                          <Text style={styles.supplementName}>{supp.name}</Text>
                          <Text style={styles.supplementDose}>{supp.dose}</Text>
                        </View>
                        <View style={styles.supplementBenefitRow}>
                          <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
                          <Text style={styles.supplementTiming}>{supp.timing.toUpperCase()}</Text>
                        </View>
                        <Text style={{ ...t.label, color: '#737373', letterSpacing: 2, marginTop: 10 }}>
                          UNLOCK PRO →
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
                return (
                  <View
                    key={supp.name}
                    style={index < supplements.length - 1
                      ? flattenStyle([styles.supplementRow, styles.supplementBorder])
                      : styles.supplementRow}
                    accessible={true}
                    accessibilityLabel={`${supp.name}, ${supp.dose}, ${supp.benefit}, take ${supp.timing}`}
                  >
                    <View style={styles.supplementLeft}>
                      <View style={styles.supplementNameRow}>
                        <Text style={styles.supplementName}>{supp.name}</Text>
                        <Text style={styles.supplementDose}>{supp.dose}</Text>
                      </View>
                      <View style={styles.supplementBenefitRow}>
                        <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
                        <Text style={styles.supplementTiming}>{supp.timing.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: '#525252', paddingVertical: 12, alignItems: 'center', marginTop: 32 }}
              onPress={() => router.push('/supplements')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Track today's supplement stack"
            >
              <Text style={{ ...t.label, color: '#c8c8c8', letterSpacing: 2 }}>TRACK TODAY&apos;S STACK →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 0,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  iconCenter: {
    alignItems: 'center',
  },
  prescriptionLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginTop: 12,
  },
  prescriptionTitle: {
    ...t.headlineMd,
    textAlign: 'center',
    marginTop: 8,
  },
  prescriptionSub: {
    ...t.bodyMuted,
    fontSize: 14,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  heroRxLabel: {
    ...t.label,
    letterSpacing: 4,
    fontSize: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: '#0d0d0d',
  },
  startButton: {
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  startButtonText: {
    ...t.label,
    letterSpacing: 3,
    fontSize: 11,
  },
  alternativesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginBottom: 4,
  },
  alternativesLabel: {
    ...t.label,
    color: '#525252',
    letterSpacing: 3,
    fontSize: 10,
  },
  alternativesArrow: {
    ...t.label,
    color: '#525252',
    fontSize: 14,
  },
  workoutCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 16,
    marginBottom: 12,
    borderRadius: 0,
  },
  workoutCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutNumber: {
    ...t.number,
    letterSpacing: 2,
  },
  workoutCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutDuration: {
    ...t.label,
    color: '#c8c8c8',
    fontSize: 12,
    fontWeight: '600',
  },
  intensityBadge: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  intensityBadgeText: {
    ...t.label,
    color: '#c8c8c8',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '600',
  },
  workoutNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  workoutName: {
    ...t.headlineSm,
  },
  workoutArrow: {
    fontSize: 18,
    fontWeight: '300',
    marginLeft: 8,
  },
  workoutVibe: {
    ...t.soft,
    color: '#c8c8c8',
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 4,
  },
  scienceInline: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginTop: 14,
    paddingTop: 14,
  },
  scienceInlineLabel: {
    ...t.label,
    letterSpacing: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  scienceInlineText: {
    ...t.bodyMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  stackTitle: {
    ...t.headlineSm,
  },
  stackSub: {
    ...t.bodySm,
    marginTop: 4,
  },
  supplementList: {
    marginTop: 24,
  },
  supplementRow: {
    paddingVertical: 16,
  },
  supplementBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  supplementLeft: {
    flex: 1,
  },
  supplementNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplementName: {
    ...t.headlineSm,
    fontSize: 15,
  },
  supplementDose: {
    ...t.label,
    color: '#c8c8c8',
    fontSize: 12,
  },
  supplementBenefitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  supplementBenefit: {
    ...t.bodyMuted,
    fontSize: 13,
  },
  supplementTiming: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
});
