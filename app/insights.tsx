import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  getSessions,
  clearSessions,
  getStreak,
  getAverageChange,
  Session,
} from '@/lib/storage';
import type { MoodKey } from '@/lib/storage';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { MoodIcon } from '@/components/MoodIcon';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { ShareCard } from '@/components/ShareCard';
import { type as t, fonts } from '../lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PremiumSheet } from '@/components/PremiumSheet';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const DAY_ABBREVS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CASE_PANEL_HEIGHT = Dimensions.get('window').height * 0.52;

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

const BAR_MAX_HEIGHT = 60;
const BAR_WIDTH = 18;

export default function InsightsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const [caseSession, setCaseSession] = useState<Session | null>(null);
  const shareCardRef = useRef<ViewShot>(null);
  const casePanelAnim = useRef(new Animated.Value(CASE_PANEL_HEIGHT)).current;
  const caseBackdropAnim = useRef(new Animated.Value(0)).current;
  const { isPremium } = useSubscription();
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const loadSessions = useCallback(() => {
    setIsLoading(true);
    getSessions().then((data) => {
      setSessions(data);
      setIsLoading(false);
    });
  }, []);

  useFocusEffect(loadSessions);

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const avgChange = useMemo(() => getAverageChange(sessions), [sessions]);
  const sessionCount = sessions.length;

  const last7 = useMemo(() => sessions.slice(-7), [sessions]);
  const recent10 = useMemo(() => [...sessions].reverse().slice(0, isPremium ? 10 : 3), [sessions, isPremium]);

  const mostCommonMood = useMemo(() => sessionCount >= 3 ? getMostCommonMood(sessions) : null, [sessions, sessionCount]);

  const handleBurn = async () => {
    await clearSessions();
    setSessions([]);
    setShowBurnConfirm(false);
  };

  const handleShare = async () => {
    try {
      const uri = await shareCardRef.current?.capture?.();
      if (!uri) return;
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      // Share failed silently — non-critical feature
    }
  };

  const showCasePanel = useCallback((session: Session) => {
    setCaseSession(session);
    Animated.parallel([
      Animated.spring(casePanelAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
      Animated.timing(caseBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [casePanelAnim, caseBackdropAnim]);

  const dismissCasePanel = useCallback(() => {
    Animated.parallel([
      Animated.timing(casePanelAnim, { toValue: CASE_PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(caseBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setCaseSession(null));
  }, [casePanelAnim, caseBackdropAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← HOME</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.evidenceLabel}>THE EVIDENCE</Text>
        <Text style={styles.headline}>Cold hard proof you&apos;re not falling apart.</Text>
        <Text style={styles.subtext}>Data doesn&apos;t lie. Even when your brain does.</Text>

        {/* Stats row */}
        {isLoading ? (
          <View style={styles.statsRow}>
            <Text style={styles.statsLoading}>Loading your data…</Text>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View
              style={[styles.statItem, { borderTopWidth: 2, borderTopColor: '#5EAAB5' }]}
              accessible={true}
              accessibilityLabel={`${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`}
            >
              <Text style={{ ...t.dataValue, color: '#5EAAB5' }}>{sessionCount}</Text>
              <Text style={styles.statLabel}>SESSIONS</Text>
            </View>
            <View style={styles.statDivider} />
            <View
              style={[styles.statItem, { borderTopWidth: 2, borderTopColor: '#059669' }]}
              accessible={true}
              accessibilityLabel={`Average intensity change: ${sessionCount === 0 ? 'no data' : formatChange(avgChange) + ' points'}`}
            >
              <Text style={{ ...t.dataValue, color: '#059669' }}>
                {sessionCount === 0 ? '—' : formatChange(avgChange)}
              </Text>
              <Text style={styles.statLabel}>AVG CHANGE</Text>
            </View>
            <View style={styles.statDivider} />
            <View
              style={[styles.statItem, { borderTopWidth: 2, borderTopColor: '#D97706' }]}
              accessible={true}
              accessibilityLabel={`${streak} ${streak === 1 ? 'day' : 'days'} streak`}
            >
              <Text style={{ ...t.dataValue, color: '#D97706' }}>{streak}</Text>
              <Text style={styles.statLabel}>DAY STREAK</Text>
            </View>
          </View>
        )}

        {/* Supplement Tracker button */}
        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: '#525252', paddingVertical: 12, alignItems: 'center', marginTop: 16 }}
          onPress={() => isPremium ? router.push('/supplements') : setShowPremiumSheet(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isPremium ? 'Open supplement tracker' : 'Unlock supplement tracker with Pro'}
        >
          <Text style={{ ...t.label, color: '#c8c8c8', letterSpacing: 2 }}>
            {isPremium ? 'SUPPLEMENT TRACKER →' : 'SUPPLEMENT TRACKER [PRO] →'}
          </Text>
        </TouchableOpacity>

        {/* Calendar */}
        {isPremium ? (
          <View style={{ marginTop: 32 }}>
            <WorkoutCalendar sessions={sessions} />
          </View>
        ) : (
          <View style={styles.lockedCalendar}>
            <View style={styles.lockedOverlay}>
              <Text style={styles.lockedCalendarTitle}>Track your progress over time</Text>
              <TouchableOpacity
                style={styles.lockedCalendarButton}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Start free trial to unlock calendar"
              >
                <Text style={styles.lockedCalendarButtonText}>START FREE TRIAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Streak callout */}
        {streak >= 5 && (
          <View style={styles.streakCallout}>
            <Text style={styles.streakCalloutText}>
              {streak}-day streak. Most gym bros are jealous.
            </Text>
          </View>
        )}

        {/* Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartLabel}>LAST {last7.length} SESSIONS</Text>
          {!isLoading && last7.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.noSessions}>No sessions yet.</Text>
              <Text style={styles.noSessionsSub}>Complete a workout to see your data here.</Text>
            </View>
          ) : (
            <View style={styles.chart}>
              {last7.map((session, index) => {
                const preHeight = Math.max(((session.intensity ?? 0) / 10) * BAR_MAX_HEIGHT, 4);
                const postHeight = Math.max(((session.postScore ?? 0) / 10) * BAR_MAX_HEIGHT, 4);
                const dayAbbr = DAY_ABBREVS[new Date(session.timestamp).getDay()] ?? '—';
                return (
                  <View
                    key={session.id ?? index}
                    style={styles.chartGroup}
                    accessible={true}
                    accessibilityLabel={`${dayAbbr}: intensity ${session.intensity ?? 0} before, ${session.postScore ?? 0} after`}
                  >
                    <View style={styles.chartBars}>
                      <View
                        style={{ width: BAR_WIDTH, height: preHeight, maxHeight: BAR_MAX_HEIGHT, backgroundColor: '#525252' }}
                        importantForAccessibility="no"
                      />
                      <View
                        style={{ width: BAR_WIDTH, height: postHeight, maxHeight: BAR_MAX_HEIGHT, backgroundColor: '#059669' }}
                        importantForAccessibility="no"
                      />
                    </View>
                    <Text style={styles.chartDay}>{dayAbbr}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={{ width: 8, height: 8, backgroundColor: '#525252' }} />
              <Text style={styles.legendText}>BEFORE</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={{ width: 8, height: 8, backgroundColor: '#059669' }} />
              <Text style={styles.legendText}>AFTER</Text>
            </View>
          </View>
        </View>

        {/* Pattern section */}
        {sessionCount >= 3 && mostCommonMood && (
          <View style={styles.patternBox}>
            <Text style={styles.patternLabel}>PATTERN</Text>
            <Text style={styles.patternText}>
              Your most common mood is {MOODS[mostCommonMood].name}. Your average improvement
              is {formatChange(avgChange)} points.
            </Text>
          </View>
        )}

        {/* Case History */}
        {recent10.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>CASE HISTORY</Text>
            {recent10.map((session) => {
              const change = session.postScore - session.intensity;
              const changeStr = change >= 0 ? `+${change}` : `${change}`;
              const changeColor = change >= 0 ? '#059669' : '#737373';
              const moodColor = MOODS[session.mood]?.color ?? '#737373';
              const date = new Date(session.timestamp);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${DAY_ABBREVS[date.getDay()]}`;
              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.recentRow}
                  onPress={() => showCasePanel(session)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.workoutName}, ${dateStr}, change ${changeStr}. Tap for details.`}
                >
                  <MoodIcon mood={session.mood} size={20} color={moodColor} />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentWorkout}>{session.workoutName}</Text>
                    <Text style={styles.recentDate}>{dateStr}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    {session.rating === 'yes' && (
                      <Text style={styles.recentStar}>★</Text>
                    )}
                    <Text style={{ ...t.dataValue, fontSize: 16, fontFamily: fonts.mono.regular, color: changeColor }}>{changeStr}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Share Progress button */}
        {sessionCount > 0 && (
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: '#525252', paddingVertical: 16, alignItems: 'center', marginBottom: 12, marginTop: 32 }}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share your progress"
          >
            <Text style={{ ...t.label, color: '#c8c8c8', letterSpacing: 2 }}>SHARE PROGRESS →</Text>
          </TouchableOpacity>
        )}

        {/* Do it again */}
        <TouchableOpacity
          style={styles.doItAgain}
          onPress={() => router.replace('/home')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Start another workout"
        >
          <Text style={styles.doItAgainText}>DO IT AGAIN →</Text>
        </TouchableOpacity>

        {/* Burn it all down */}
        {sessionCount > 0 && (
          <TouchableOpacity
            onPress={() => setShowBurnConfirm(true)}
            activeOpacity={0.6}
            style={styles.burnButton}
            accessibilityRole="button"
            accessibilityLabel="Delete all session data"
          >
            <Text style={styles.burnButtonText}>BURN IT ALL DOWN</Text>
          </TouchableOpacity>
        )}

        {/* Burn confirm */}
        {showBurnConfirm && (
          <View style={styles.burnConfirm}>
            <Text style={styles.burnConfirmTitle}>Permanently delete all session data?</Text>
            <View style={styles.burnConfirmButtons}>
              <TouchableOpacity
                onPress={() => setShowBurnConfirm(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.neverMind}>Never mind</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBurn}
                activeOpacity={0.7}
                style={styles.burnItButton}
                accessibilityRole="button"
                accessibilityLabel="Confirm delete all sessions"
              >
                <Text style={styles.burnItText}>Burn it</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Hidden ShareCard for screenshot */}
      <ViewShot ref={shareCardRef} style={{ position: 'absolute', left: -2000, top: 0 }}>
        <ShareCard sessions={sessions} streak={streak} avgChange={avgChange} />
      </ViewShot>

      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
      />

      {/* Case History backdrop */}
      <Animated.View
        style={[styles.caseBackdrop, { opacity: caseBackdropAnim }]}
        pointerEvents={caseSession ? 'auto' : 'none'}
      >
        <TouchableWithoutFeedback onPress={dismissCasePanel} accessibilityLabel="Dismiss case file" accessibilityRole="button">
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Case History slide-up panel */}
      <Animated.View style={[styles.casePanel, { transform: [{ translateY: casePanelAnim }] }]}>
        {caseSession && (() => {
          const cs = caseSession;
          const change = cs.postScore - cs.intensity;
          const changeStr = change >= 0 ? `+${change}` : `${change}`;
          const changeColor = change >= 0 ? '#059669' : '#737373';
          const moodColor = MOODS[cs.mood]?.color ?? '#737373';
          const date = new Date(cs.timestamp);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${DAY_ABBREVS[date.getDay()]}`;
          const ratingLabel = cs.rating === 'yes' ? 'YES ★' : cs.rating === 'somewhat' ? 'SOMEWHAT' : cs.rating === 'no' ? 'NOT REALLY' : null;
          const ratingColor = cs.rating === 'yes' ? '#059669' : '#525252';
          return (
            <View style={styles.casePanelContent}>
              <View style={styles.casePanelHandle} />
              <Text style={styles.casePanelTitle}>DR. MOODRX // CASE FILE</Text>
              <View style={styles.casePanelMoodRow}>
                <View style={[styles.casePanelMoodBadge, { borderColor: moodColor }]}>
                  <Text style={[styles.casePanelMoodText, { color: moodColor }]}>
                    {MOODS[cs.mood].name.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.casePanelDate}>{dateStr}</Text>
              </View>
              <Text style={styles.casePanelWorkoutName}>{cs.workoutName}</Text>
              <View style={styles.casePanelScores}>
                <Text style={styles.casePanelScoreLabel}>BEFORE</Text>
                <Text style={styles.casePanelScoreVal}>{cs.intensity}</Text>
                <Text style={styles.casePanelScoreSep}>→</Text>
                <Text style={styles.casePanelScoreLabel}>AFTER</Text>
                <Text style={styles.casePanelScoreVal}>{cs.postScore}</Text>
                <Text style={[styles.casePanelChange, { color: changeColor }]}>{changeStr}</Text>
              </View>
              {ratingLabel && (
                <Text style={[styles.casePanelRating, { color: ratingColor }]}>
                  YOU SAID: {ratingLabel}
                </Text>
              )}
              <TouchableOpacity
                style={styles.casePrescribeBtn}
                onPress={() => {
                  dismissCasePanel();
                  if (cs.workoutId) {
                    router.push({ pathname: '/workout', params: { mood: cs.mood, workoutId: cs.workoutId, intensity: String(cs.intensity) } });
                  } else {
                    router.push({ pathname: '/prescription', params: { mood: cs.mood, intensity: String(cs.intensity) } });
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Prescribe this workout again"
              >
                <Text style={styles.casePrescribeBtnText}>PRESCRIBE THIS AGAIN →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={dismissCasePanel}
                activeOpacity={0.7}
                style={styles.caseDismissBtn}
                accessibilityRole="button"
                accessibilityLabel="Close case file"
              >
                <Text style={styles.caseDismissBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </Animated.View>
    </Animated.View>
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
    paddingTop: 56,
    paddingBottom: 32,
  },
  backButton: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  evidenceLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 24,
    marginTop: 8,
  },
  subtext: {
    ...t.bodyMuted,
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#111111',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLoading: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1a1a1a',
    alignSelf: 'stretch',
  },
  statLabel: {
    ...t.dataLabel,
    color: '#c8c8c8',
    letterSpacing: 2,
    marginTop: 4,
  },
  streakCallout: {
    borderLeftWidth: 2,
    borderLeftColor: '#D97706',
    paddingLeft: 12,
    marginTop: 16,
  },
  streakCalloutText: {
    ...t.label,
    color: '#D97706',
    letterSpacing: 1,
  },
  chartSection: {
    marginTop: 32,
  },
  chartLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginBottom: 16,
  },
  emptyChart: {
    paddingVertical: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  noSessions: {
    ...t.headlineSm,
    color: '#c8c8c8',
    fontSize: 14,
  },
  noSessionsSub: {
    ...t.label,
    color: '#333333',
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 1,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 24,
    gap: 8,
  },
  chartGroup: {
    alignItems: 'center',
    flex: 1,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: BAR_MAX_HEIGHT,
  },
  chartDay: {
    ...t.timestamp,
    color: '#c8c8c8',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 1,
  },
  patternBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#059669',
    backgroundColor: '#111111',
    padding: 16,
    marginTop: 24,
  },
  patternLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
  patternText: {
    ...t.body,
    fontSize: 14,
    marginTop: 8,
  },
  recentSection: {
    marginTop: 32,
  },
  recentLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  recentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentStar: {
    color: '#059669',
    fontSize: 12,
  },
  recentWorkout: {
    ...t.body,
    fontSize: 14,
  },
  recentDate: {
    ...t.timestamp,
    color: '#c8c8c8',
    letterSpacing: 1,
    marginTop: 2,
  },
  doItAgain: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
    borderRadius: 0,
  },
  doItAgainText: {
    ...t.button,
    letterSpacing: 3,
  },
  burnButton: {
    marginTop: 48,
    alignItems: 'center',
    paddingBottom: 16,
  },
  burnButtonText: {
    ...t.label,
    color: '#262626',
    letterSpacing: 3,
  },
  burnConfirm: {
    borderWidth: 2,
    borderColor: '#E11D48',
    padding: 16,
    marginTop: 16,
  },
  burnConfirmTitle: {
    ...t.body,
    fontSize: 14,
  },
  burnConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  neverMind: {
    ...t.label,
    color: '#c8c8c8',
  },
  burnItButton: {
    borderWidth: 1,
    borderColor: '#E11D48',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  burnItText: {
    ...t.label,
    color: '#E11D48',
    letterSpacing: 1,
  },
  lockedCalendar: {
    marginTop: 28,
    height: 180,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedOverlay: {
    alignItems: 'center',
    gap: 16,
  },
  lockedCalendarTitle: {
    ...t.bodyMuted,
    color: '#c8c8c8',
    textAlign: 'center',
  },
  lockedCalendarButton: {
    borderWidth: 1,
    borderColor: '#525252',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  lockedCalendarButtonText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  caseBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  casePanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CASE_PANEL_HEIGHT,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  casePanelContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flex: 1,
  },
  casePanelHandle: {
    width: 36,
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  casePanelTitle: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    fontSize: 10,
    marginBottom: 14,
  },
  casePanelMoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  casePanelMoodBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  casePanelMoodText: {
    ...t.label,
    letterSpacing: 2,
    fontSize: 11,
  },
  casePanelDate: {
    ...t.timestamp,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  casePanelWorkoutName: {
    ...t.headlineSm,
    fontSize: 18,
    marginBottom: 16,
  },
  casePanelScores: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  casePanelScoreLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
    fontSize: 10,
  },
  casePanelScoreVal: {
    ...t.dataValue,
    fontSize: 20,
  },
  casePanelScoreSep: {
    ...t.label,
    color: '#333333',
  },
  casePanelChange: {
    ...t.dataValue,
    fontSize: 20,
    marginLeft: 4,
  },
  casePanelRating: {
    ...t.label,
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 4,
  },
  casePrescribeBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  casePrescribeBtnText: {
    ...t.button,
    letterSpacing: 3,
  },
  caseDismissBtn: {
    alignItems: 'center',
    paddingTop: 16,
  },
  caseDismissBtnText: {
    ...t.label,
    color: '#333333',
    letterSpacing: 2,
  },
});
