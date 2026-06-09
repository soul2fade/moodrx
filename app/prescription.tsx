import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { MoodKey } from '@/lib/storage';
import { getUserProfile, UserProfile } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutsForMood, Workout } from '@/lib/workouts';
import { getSupplementsForMood, Supplement } from '@/lib/supplements';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '../lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSessions } from '@/contexts/SessionsContext';
import { getPrescriptionWorkouts, getWorkoutBadge } from '@/lib/workout-insights';
import { getFreeTierSummary, isSupplementUnlocked, isWorkoutUnlocked } from '@/lib/free-tier';
import { PremiumSheet } from '@/components/PremiumSheet';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useDrMoodRxLine } from '@/hooks/useDrMoodRxLine';
import { getDrMoodRxLine } from '@/utils/dr-moodrx';
import { colors } from '@/lib/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'workouts' | 'stack';

export default function PrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mood: string; intensity: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const parsedIntensity = parseInt(params.intensity ?? '', 10);
  const intensity = Number.isFinite(parsedIntensity)
    ? Math.min(10, Math.max(1, parsedIntensity))
    : 5;
  const [activeTab, setActiveTab] = useState<Tab>('workouts');
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedSupp, setSelectedSupp] = useState<Supplement | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const { isPremium } = useSubscription();
  const { sessions } = useSessions();

  const { fadeAnim, slideAnim } = useScreenAnimation();

  useFocusEffect(
    useCallback(() => {
      getUserProfile().then(setUserProfile);
    }, [])
  );

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const drMoodRxLine = useMemo(() => getDrMoodRxLine(mood, intensity), [mood, intensity]);
  const preInsult = useDrMoodRxLine(mood, 'pre');
  const { ordered: workouts, alternateNote } = useMemo(
    () => getPrescriptionWorkouts(getWorkoutsForMood(mood), sessions),
    [mood, sessions],
  );
  const supplements = getSupplementsForMood(mood);
  const freeTierSummary = useMemo(
    () => getFreeTierSummary(workouts, isPremium),
    [workouts, isPremium],
  );

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
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 56) }]}>
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
          <View style={flattenStyle([styles.drBox, { borderLeftColor: accentColor }])}>
            <Text style={styles.drLabel}>DR. MOODRX SAYS</Text>
            <Text style={styles.drText}>{drMoodRxLine}</Text>
          </View>
          {preInsult !== '' && (
            <Text style={styles.insultLine}>{preInsult}</Text>
          )}
          {userProfile.preferredTime && (
            <Text style={styles.personalizationNote}>
              Matched to your {userProfile.preferredTime.toLowerCase()} preference
            </Text>
          )}
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
                    ? styles.tabTextActive
                    : styles.tabTextInactive}
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
            {alternateNote && (
              <View style={styles.alternateBanner}>
                <Text style={styles.alternateBannerText}>
                  {alternateNote.demotedName} didn&apos;t land twice. Try {alternateNote.suggestedName} first.
                </Text>
              </View>
            )}
            {freeTierSummary && (
              <Text style={styles.freeTierSummary}>{freeTierSummary}</Text>
            )}
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
              {getWorkoutBadge(sessions, workouts[0]) && (
                <Text style={styles.workoutBadge}>{getWorkoutBadge(sessions, workouts[0])}</Text>
              )}
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
                  const isLocked = !isWorkoutUnlocked(isPremium, index, workouts.length);
                  const isFreeAlternative = isWorkoutUnlocked(isPremium, index, workouts.length) && index > 0;
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
                          <Text style={styles.unlockProText}>UNLOCK PRO →</Text>
                        </View>
                        <Text style={styles.workoutVibe}>{workout.vibe}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <React.Fragment key={workout.id}>
                    {isFreeAlternative && (
                      <Text style={styles.cantDoThatLabel}>CAN&apos;T DO THAT? TRY THIS</Text>
                    )}
                    <TouchableOpacity
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
                      {getWorkoutBadge(sessions, workout) && (
                        <Text style={styles.workoutBadgeMuted}>{getWorkoutBadge(sessions, workout)}</Text>
                      )}
                      <Text style={styles.workoutVibe}>{workout.vibe}</Text>
                    </TouchableOpacity>
                    </React.Fragment>
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
                const isLocked = !isSupplementUnlocked(isPremium, index);
                return (
                  <TouchableOpacity
                    key={supp.name}
                    onPress={() => setSelectedSupp(supp)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${supp.name}, ${supp.benefit}. Tap for details.`}
                    style={index < supplements.length - 1
                      ? flattenStyle([styles.supplementRow, styles.supplementBorder, isLocked && { opacity: 0.4 }])
                      : flattenStyle([styles.supplementRow, isLocked && { opacity: 0.4 }])}
                  >
                    <View style={styles.supplementLeft}>
                      <View style={styles.supplementNameRow}>
                        <Text style={styles.supplementName}>{supp.name}</Text>
                        <Text style={[styles.supplementDose, { color: accentColor }]}>{supp.dose}</Text>
                      </View>
                      <View style={styles.supplementBenefitRow}>
                        <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
                        <Text style={styles.supplementTiming}>{supp.timing.toUpperCase()}</Text>
                      </View>
                      {isLocked && (
                        <Text style={styles.unlockProTextStack}>UNLOCK PRO →</Text>
                      )}
                    </View>
                    <Text style={[styles.suppDetailChevron, { color: accentColor }]}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.trackStackBtn}
              onPress={() => router.push('/supplements')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Track today's supplement stack"
            >
              <Text style={styles.trackStackBtnText}>TRACK TODAY&apos;S STACK →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
      />

      {/* Supplement detail bottom sheet */}
      <Modal
        visible={selectedSupp !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSupp(null)}
      >
        <TouchableOpacity
          style={styles.suppModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedSupp(null)}
        />
        {selectedSupp && (
          <View style={styles.suppModalSheet}>
            <View style={styles.suppModalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header */}
              <View style={styles.suppModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suppModalName}>{selectedSupp.name}</Text>
                  <Text style={styles.suppModalDose}>{selectedSupp.dose} · {selectedSupp.timing.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedSupp(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Text style={styles.suppModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Mood tags */}
              <Text style={styles.suppModalSectionLabel}>GOOD FOR</Text>
              <View style={styles.suppModalMoodRow}>
                {selectedSupp.moods.map((m) => (
                  <View key={m} style={[styles.suppModalMoodTag, { borderColor: MOODS[m].color }]}>
                    <Text style={[styles.suppModalMoodTagText, { color: MOODS[m].color }]}>
                      {MOODS[m].name.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Science */}
              <Text style={[styles.suppModalSectionLabel, { marginTop: 20 }]}>WHY THIS WORKS</Text>
              <Text style={styles.suppModalScience}>{selectedSupp.science}</Text>

              {/* Sources */}
              {(selectedSupp.sources?.length ?? 0) > 0 && (
                <>
                  <Text style={[styles.suppModalSectionLabel, { marginTop: 20 }]}>SOURCES</Text>
                  {selectedSupp.sources.map((src, i) => (
                    <Text key={i} style={styles.suppModalSource}>{i + 1}. {src}</Text>
                  ))}
                </>
              )}

              {/* Unlock CTA for locked supplements */}
              {!isSupplementUnlocked(isPremium, supplements.indexOf(selectedSupp)) && (
                <TouchableOpacity
                  style={[styles.suppModalUnlockBtn, { borderColor: accentColor }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedSupp(null);
                    setShowPremiumSheet(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock Pro to access full stack"
                >
                  <Text style={[styles.suppModalUnlockText, { color: accentColor }]}>
                    UNLOCK FULL STACK WITH PRO →
                  </Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
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
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: undefined,
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
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 12,
    lineHeight: undefined,
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
  drBox: {
    borderLeftWidth: 3,
    backgroundColor: '#0a0a0a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  drLabel: {
    ...t.label,
    color: '#d4d4d4',
    letterSpacing: 2,
  },
  drText: {
    ...t.soft,
    color: '#ffffff',
    marginTop: 6,
  },
  insultLine: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#ffffff',
    marginTop: 12,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  personalizationNote: {
    ...t.label,
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
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
    color: '#ffffff',
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
    fontSize: 12,
    marginBottom: 10,
    marginTop: 4,
    lineHeight: undefined,
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
    fontSize: 12,
    lineHeight: undefined,
  },
  alternativesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 8,
    marginTop: 4,
    backgroundColor: '#111111',
  },
  alternativesLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    fontSize: 13,
    lineHeight: undefined,
  },
  alternativesArrow: {
    ...t.label,
    color: '#ffffff',
    fontSize: 18,
    lineHeight: undefined,
  },
  cantDoThatLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 4,
    lineHeight: undefined,
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
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
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
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
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
    lineHeight: undefined,
  },
  workoutArrow: {
    fontSize: 18,
    fontWeight: '300',
    marginLeft: 8,
  },
  workoutVibe: {
    ...t.soft,
    color: '#ffffff',
    fontSize: 15,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  workoutBadge: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 1.5,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  workoutBadgeMuted: {
    ...t.label,
    color: '#999999',
    letterSpacing: 1.5,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  alternateBanner: {
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  alternateBannerText: {
    ...t.bodySm,
    color: '#c8c8c8',
    lineHeight: 20,
  },
  freeTierSummary: {
    ...t.bodySm,
    color: '#a3a3a3',
    marginBottom: 12,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: undefined,
  },
  scienceInlineText: {
    ...t.bodyMuted,
    fontSize: 16,
    marginTop: 8,
    lineHeight: 24,
  },
  stackTitle: {
    ...t.headlineSm,
    lineHeight: undefined,
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
    lineHeight: undefined,
  },
  supplementDose: {
    ...t.label,
    color: '#ffffff',
    fontSize: 13,
  },
  supplementBenefitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  supplementBenefit: {
    ...t.bodyMuted,
    fontSize: 14,
  },
  supplementTiming: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
  },
  tabTextActive: {
    ...t.labelBright,
    letterSpacing: 2,
    lineHeight: undefined,
  },
  tabTextInactive: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: undefined,
  },
  unlockProText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: undefined,
  },
  unlockProTextStack: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 10,
    lineHeight: undefined,
  },
  trackStackBtn: {
    borderWidth: 1,
    borderColor: '#525252',
    paddingVertical: 12,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  trackStackBtnText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: undefined,
  },
  suppDetailChevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
    alignSelf: 'center',
  },
  suppModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  suppModalSheet: {
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '80%',
  },
  suppModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  suppModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  suppModalName: {
    ...t.headlineSm,
    fontSize: 18,
    lineHeight: undefined,
  },
  suppModalDose: {
    ...t.label,
    color: '#999999',
    fontSize: 13,
    marginTop: 4,
    lineHeight: undefined,
  },
  suppModalClose: {
    fontSize: 18,
    color: '#999999',
    paddingLeft: 16,
    paddingTop: 2,
  },
  suppModalSectionLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    fontSize: 12,
    lineHeight: undefined,
    marginBottom: 10,
  },
  suppModalMoodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suppModalMoodTag: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suppModalMoodTagText: {
    ...t.label,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: undefined,
  },
  suppModalScience: {
    ...t.body,
    color: '#cccccc',
    fontSize: 15,
    lineHeight: 23,
  },
  suppModalSource: {
    ...t.body,
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  suppModalUnlockBtn: {
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  suppModalUnlockText: {
    ...t.label,
    fontSize: 13,
    letterSpacing: 2,
    lineHeight: undefined,
  },
});
