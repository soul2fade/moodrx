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
  Session,
} from '@/lib/storage';
import { buildPatterns, sessionImprovement, noticedEmptyState, NOTICED_COUNTDOWN_THRESHOLD, type PatternItem } from '@/lib/patterns';
import { getTopEffectiveCombinations } from '@/lib/workout-insights';
import { useSessions } from '@/contexts/SessionsContext';
import { MOODS } from '@/lib/moods';
import { MoodIcon } from '@/components/MoodIcon';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { MoodArc } from '@/components/MoodArc';
import { ShareCard } from '@/components/ShareCard';
import { formatChange, getLastNDays } from '@/lib/analytics';
import { DAY_ABBREVS } from '@/lib/dateUtils';
import { colors } from '@/lib/colors';
import { type as t, fonts } from '../lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PremiumSheet } from '@/components/PremiumSheet';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useBottomPanel } from '@/hooks/useBottomPanel';
import { BottomNav } from '@/components/BottomNav';
import { getHealthPlatformLabel, getHealthSnapshot, isHealthSyncAvailable, type HealthSnapshot } from '@/lib/health';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CASE_PANEL_HEIGHT = Math.min(Dimensions.get('window').height * 0.52, Dimensions.get('window').height - 200);

const BAR_MAX_HEIGHT = 60;
const BAR_WIDTH = 18;

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const {
    sessions,
    isLoading,
    streak,
    avgChange,
    sessionCount,
    clearSessions,
  } = useSessions();
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const [caseSession, setCaseSession] = useState<Session | null>(null);
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null);
  const shareCardRef = useRef<ViewShot>(null);
  const { panelAnim: casePanelAnim, backdropAnim: caseBackdropAnim, show: showCasePanelAnim, dismiss: dismissCasePanelAnim } = useBottomPanel(CASE_PANEL_HEIGHT);
  const { isPremium, isLoading: subLoading } = useSubscription();
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  useFocusEffect(
    useCallback(() => {
      if (!isHealthSyncAvailable()) return;
      getHealthSnapshot().then(setHealthSnapshot).catch(() => {});
    }, []),
  );

  const effectiveCombos = useMemo(
    () => getTopEffectiveCombinations(sessions),
    [sessions],
  );

  const last7Days = useMemo(() => getLastNDays(sessions, 7), [sessions]);
  /** Recent session list. Premium gets all sessions; free is capped at 3
   *  (the upsell row promises the remainder once they upgrade). The cap
   *  was previously 10 for premium, which contradicted the upsell copy's
   *  implied "all sessions" promise for users with >13 sessions. */
  const recentSessions = useMemo(() => {
    const reversed = [...sessions].reverse();
    return isPremium ? reversed : reversed.slice(0, 3);
  }, [sessions, isPremium]);

  /** On-device pattern engine (templated, no LLM, no network). `buildPatterns`
   *  already orders confident findings ahead of hedged questions, so items[0]
   *  is the single strongest signal the user has earned. Free users see exactly
   *  that one teaser ("it notices me"); Pro unlocks the full set. */
  const patterns = useMemo<PatternItem[]>(() => buildPatterns(sessions), [sessions]);
  const visiblePatterns = useMemo(
    () => (isPremium ? patterns : patterns.slice(0, 1)),
    [patterns, isPremium],
  );
  const noticed = useMemo(
    () => noticedEmptyState(sessionCount, visiblePatterns.length > 0),
    [sessionCount, visiblePatterns.length],
  );
  const lockedPatternCount = isPremium ? 0 : Math.max(patterns.length - 1, 0);

  const workoutStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalChange: number; totalImprovement: number }> = {};
    for (const s of sessions) {
      if (!s.workoutName) continue;
      const key = s.workoutId ?? s.workoutName;
      if (!map[key]) map[key] = { name: s.workoutName, count: 0, totalChange: 0, totalImprovement: 0 };
      map[key].count += 1;
      map[key].totalChange += (s.postScore - s.intensity); // raw delta (factual, displayed)
      map[key].totalImprovement += sessionImprovement(s);  // mood-aware (drives color)
    }
    const all = Object.values(map)
      .sort((a, b) => b.count - a.count)
      .map(w => ({ ...w, avgChange: w.totalChange / w.count, avgImprovement: w.totalImprovement / w.count }));
    return { visible: isPremium ? all : all.slice(0, 3), total: all.length };
  }, [sessions, isPremium]);

  const sessionNotes = useMemo(() => {
    const withNotes = [...sessions]
      .reverse()
      .filter(s => s.note && s.note.trim().length > 0);
    return { visible: isPremium ? withNotes : withNotes.slice(0, 3), total: withNotes.length };
  }, [sessions, isPremium]);

  const handleBurn = async () => {
    await clearSessions();
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
    showCasePanelAnim();
  }, [showCasePanelAnim]);

  const dismissCasePanel = useCallback(() => {
    dismissCasePanelAnim(() => setCaseSession(null));
  }, [dismissCasePanelAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statSkeleton}>
                <View style={styles.statSkeletonBar} />
                <View style={styles.statSkeletonLabel} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View
              style={[styles.statItem, { borderTopWidth: 2, borderTopColor: '#5EAAB5' }]}
              accessible={true}
              accessibilityLabel={`${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`}
            >
              <Text style={styles.statValueSessions}>{sessionCount}</Text>
              <Text style={styles.statLabel}>SESSIONS</Text>
            </View>
            <View style={styles.statDivider} />
            <View
              style={[styles.statItem, { borderTopWidth: 2, borderTopColor: '#059669' }]}
              accessible={true}
              accessibilityLabel={`Average intensity change: ${sessionCount === 0 ? 'no data' : formatChange(avgChange) + ' points'}`}
            >
              <Text style={styles.statValueChange}>
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
              <Text style={styles.statValueStreak}>{streak}</Text>
              <Text style={styles.statLabel}>DAY STREAK</Text>
            </View>
          </View>
        )}

        {healthSnapshot?.connected && (healthSnapshot.stepsToday !== null || healthSnapshot.sleepHoursLastNight !== null) && (
          <View style={styles.healthCard}>
            <Text style={styles.healthCardLabel}>
              {(healthSnapshot.platform ? getHealthPlatformLabel(healthSnapshot.platform) : 'HEALTH').toUpperCase()}
            </Text>
            <View style={styles.healthRow}>
              {healthSnapshot.stepsToday !== null && (
                <View style={styles.healthStat}>
                  <Text style={styles.healthStatValue}>{healthSnapshot.stepsToday.toLocaleString()}</Text>
                  <Text style={styles.healthStatLabel}>STEPS TODAY</Text>
                </View>
              )}
              {healthSnapshot.sleepHoursLastNight !== null && (
                <View style={styles.healthStat}>
                  <Text style={styles.healthStatValue}>{healthSnapshot.sleepHoursLastNight}h</Text>
                  <Text style={styles.healthStatLabel}>SLEEP LAST NIGHT</Text>
                </View>
              )}
            </View>
            {healthSnapshot.stepsToday !== null && healthSnapshot.sleepHoursLastNight === null && (
              <Text style={styles.healthSleepMissing}>No sleep data — this source tracks steps only.</Text>
            )}
            <Text style={styles.healthHint}>Cross-reference with your mood sessions below.</Text>
          </View>
        )}

        {/* Surface read failures rather than hiding the card silently —
            users had no way to learn a revoked permission was the problem. */}
        {healthSnapshot?.connected && healthSnapshot.readError && healthSnapshot.stepsToday === null && healthSnapshot.sleepHoursLastNight === null && (
          <TouchableOpacity
            style={styles.healthCard}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Reconnect Health"
          >
            <Text style={styles.healthCardLabel}>
              {(healthSnapshot.platform ? getHealthPlatformLabel(healthSnapshot.platform) : 'HEALTH').toUpperCase()}
            </Text>
            <Text style={styles.healthHint}>
              {healthSnapshot.readError === 'permission'
                ? 'Permission was revoked — tap to reconnect.'
                : "Couldn't read your health data — tap to reconnect."}
            </Text>
          </TouchableOpacity>
        )}

        {/* Supplement Tracker button */}
        <TouchableOpacity
          style={styles.supplementBtn}
          onPress={() => router.push('/supplements')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isPremium ? 'Open supplement tracker' : 'Unlock supplement tracker with Pro'}
        >
          <Text style={styles.supplementBtnText}>
            {isPremium ? 'SUPPLEMENT TRACKER →' : 'SUPPLEMENT TRACKER [PRO] →'}
          </Text>
        </TouchableOpacity>

        {/* Programs button */}
        <TouchableOpacity
          style={styles.supplementBtn}
          onPress={() => (isPremium ? router.push('/programs') : setShowPremiumSheet(true))}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isPremium ? 'Open programs' : 'Unlock programs with Pro'}
        >
          <Text style={styles.supplementBtnText}>
            {isPremium ? 'PROGRAMS →' : 'PROGRAMS [PRO] →'}
          </Text>
        </TouchableOpacity>

        {/* Calendar */}
        {isPremium ? (
          <View style={styles.calendarWrap}>
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
                accessibilityLabel="Unlock Pro to see your calendar"
              >
                <Text style={styles.lockedCalendarButtonText}>UNLOCK PRO</Text>
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
          <Text style={styles.chartLabel}>LAST {last7Days.length} DAY{last7Days.length === 1 ? '' : 'S'}</Text>
          {!isLoading && last7Days.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.noSessions}>No data yet.</Text>
              <Text style={styles.noSessionsSub}>Your first session is the baseline. Let&apos;s get it.</Text>
              <TouchableOpacity
                style={styles.emptyStartButton}
                onPress={() => router.replace('/home')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Start your first session"
              >
                <Text style={styles.emptyStartText}>START YOUR FIRST SESSION →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chart}>
              {last7Days.map((day) => {
                const preHeight = Math.max((day.intensity / 10) * BAR_MAX_HEIGHT, 4);
                const postHeight = Math.max((day.postScore / 10) * BAR_MAX_HEIGHT, 4);
                const dayAbbr = DAY_ABBREVS[new Date(day.latest.timestamp).getDay()] ?? '—';
                const countSuffix = day.sessionCount > 1 ? `, averaged across ${day.sessionCount} sessions` : '';
                return (
                  <View
                    key={day.date}
                    style={styles.chartGroup}
                    accessible={true}
                    accessibilityLabel={`${dayAbbr}: intensity ${day.intensity.toFixed(1)} before, ${day.postScore.toFixed(1)} after${countSuffix}`}
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

        {/* Mood Arc */}
        {sessions.length >= 2 && <MoodArc sessions={sessions} />}

        {/* What I've noticed — on-device pattern engine (findings vs hunches) */}
        {visiblePatterns.length > 0 && (
          <View style={styles.noticedSection}>
            <Text style={styles.noticedLabel}>WHAT I&apos;VE NOTICED</Text>
            {visiblePatterns.map((p) => (
              <View
                key={p.id}
                style={[styles.noticedCard, p.kind === 'finding' ? styles.noticedFinding : styles.noticedQuestion]}
                accessible={true}
                accessibilityLabel={p.kind === 'finding' ? `Pattern: ${p.text}` : `Dr. MoodRx asks: ${p.text}`}
              >
                <Text style={p.kind === 'finding' ? styles.noticedFindingTag : styles.noticedQuestionTag}>
                  {p.kind === 'finding' ? 'PATTERN' : 'DR. MOODRX ASKS'}
                </Text>
                <Text style={styles.noticedText}>{p.text}</Text>
              </View>
            ))}
            {!subLoading && !isPremium && lockedPatternCount > 0 && (
              <TouchableOpacity
                style={styles.historyUpsellRow}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`See ${lockedPatternCount} more ${lockedPatternCount === 1 ? 'pattern' : 'patterns'} with Pro`}
              >
                <Text style={styles.historyUpsellText}>
                  +{lockedPatternCount} MORE {lockedPatternCount === 1 ? 'PATTERN' : 'PATTERNS'} — UNLOCK PRO →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {visiblePatterns.length === 0 && noticed && (
          <View style={styles.noticedSection}>
            <Text style={styles.noticedLabel}>WHAT I&apos;VE NOTICED</Text>
            <View style={styles.noticedEmptyCard}>
              {noticed.stage === 'countdown' ? (
                <Text style={styles.noticedEmptyText}>
                  Patterns appear after {NOTICED_COUNTDOWN_THRESHOLD} sessions.{'\n'}
                  {sessionCount > 0 ? `${noticed.remaining} more to go.` : 'Start logging below.'}
                </Text>
              ) : (
                <Text style={styles.noticedEmptyText}>
                  Still listening. Clear patterns appear once your sessions spread across enough days and times to mean something.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* What works for you */}
        {effectiveCombos.length > 0 && (
          <View style={styles.whatWorksSection}>
            <Text style={styles.whatWorksLabel}>WHAT WORKS FOR YOU</Text>
            {effectiveCombos.map((combo) => (
              <Text key={`${combo.mood}:${combo.workoutName}`} style={styles.whatWorksItem}>
                {combo.label}
              </Text>
            ))}
          </View>
        )}

        {/* Workout History */}
        {workoutStats.visible.length > 0 && (
          <View style={styles.workoutHistSection}>
            <Text style={styles.workoutHistLabel}>WORKOUT HISTORY</Text>
            {workoutStats.visible.map((w, i) => {
              const avgStr = w.avgChange >= 0 ? `+${w.avgChange.toFixed(1)}` : w.avgChange.toFixed(1);
              // Color by mood-aware improvement, not the raw delta sign.
              const avgColor = w.avgImprovement > 0 ? '#059669' : w.avgImprovement < 0 ? '#E11D48' : '#999999';
              return (
                <View key={i} style={styles.workoutHistRow}>
                  <View style={styles.workoutHistInfo}>
                    <Text style={styles.workoutHistName}>{w.name}</Text>
                    <Text style={styles.workoutHistCount}>{w.count}×</Text>
                  </View>
                  <View style={styles.workoutHistRight}>
                    <Text style={styles.workoutHistAvgLabel}>AVG</Text>
                    <Text style={[styles.workoutHistAvgVal, { color: avgColor }]}>{avgStr}</Text>
                  </View>
                </View>
              );
            })}
            {!subLoading && !isPremium && workoutStats.total > 3 && (
              <TouchableOpacity
                style={styles.historyUpsellRow}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`See all ${workoutStats.total - 3} more workouts with Pro`}
              >
                <Text style={styles.historyUpsellText}>
                  +{workoutStats.total - 3} MORE — UNLOCK PRO →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Case History */}
        {recentSessions.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>CASE HISTORY</Text>
            {recentSessions.map((session) => {
              const change = session.postScore - session.intensity;
              const changeStr = change >= 0 ? `+${change}` : `${change}`;
              const imp = sessionImprovement(session);
              const changeColor = imp > 0 ? '#059669' : imp < 0 ? '#E11D48' : '#999999';
              const moodColor = MOODS[session.mood]?.color ?? '#999999';
              const date = new Date(session.timestamp);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${DAY_ABBREVS[date.getDay()] ?? ''}`;
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
                    {session.lightDay && (
                      <Text style={styles.recentLightBadge}>LIGHT</Text>
                    )}
                    {session.rating === 'yes' && (
                      <Text style={styles.recentStar}>★</Text>
                    )}
                    <Text style={[styles.recentChangeValue, { color: changeColor }]}>{changeStr}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!subLoading && !isPremium && sessionCount > 3 && (
              <TouchableOpacity
                style={styles.historyUpsellRow}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`See all ${sessionCount - 3} more sessions with Pro`}
              >
                <Text style={styles.historyUpsellText}>
                  +{sessionCount - 3} MORE SESSION{sessionCount - 3 === 1 ? '' : 'S'} — UNLOCK PRO →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Field Notes Journal */}
        {sessionNotes.total > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>FIELD NOTES</Text>
            {sessionNotes.visible.map((s) => {
              const date = new Date(s.timestamp);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${DAY_ABBREVS[date.getDay()] ?? ''}`;
              const moodColor = MOODS[s.mood]?.color ?? '#999999';
              return (
                <View key={s.id} style={styles.noteRow}>
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteMood, { color: moodColor }]}>
                      {MOODS[s.mood]?.name.toUpperCase()}
                    </Text>
                    <Text style={styles.noteDate}>{dateStr}</Text>
                  </View>
                  <Text style={styles.noteWorkoutName}>{s.workoutName}</Text>
                  <Text style={styles.noteText}>{s.note}</Text>
                </View>
              );
            })}
            {!subLoading && !isPremium && sessionNotes.total > 3 && (
              <TouchableOpacity
                style={styles.historyUpsellRow}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`See all ${sessionNotes.total - 3} more notes with Pro`}
              >
                <Text style={styles.historyUpsellText}>
                  +{sessionNotes.total - 3} MORE NOTES — UNLOCK PRO →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Share Progress button */}
        {sessionCount > 0 && (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share your progress"
          >
            <Text style={styles.shareBtnText}>SHARE PROGRESS →</Text>
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

      </ScrollView>
      <BottomNav />

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
          const imp = sessionImprovement(cs);
          const changeColor = imp > 0 ? '#059669' : imp < 0 ? '#E11D48' : '#999999';
          const moodColor = MOODS[cs.mood]?.color ?? '#999999';
          const date = new Date(cs.timestamp);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${DAY_ABBREVS[date.getDay()] ?? ''}`;
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
              {cs.note ? (
                <View style={styles.caseNoteBox}>
                  <Text style={styles.caseNoteLabel}>FIELD NOTES</Text>
                  <Text style={styles.caseNoteText}>{cs.note}</Text>
                </View>
              ) : null}
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
    color: '#ffffff',
    letterSpacing: 2,
  },
  evidenceLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 27,
    marginTop: 8,
  },
  subtext: {
    ...t.bodyMuted,
    fontSize: 16,
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
  statSkeleton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  statSkeletonBar: {
    width: 48,
    height: 28,
    backgroundColor: '#252525',
  },
  statSkeletonLabel: {
    width: 64,
    height: 10,
    backgroundColor: '#1a1a1a',
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
    color: '#ffffff',
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
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 16,
  },
  noSessionsSub: {
    ...t.label,
    color: '#ffffff',
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptyStartButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyStartText: {
    ...t.label,
    color: '#059669',
    letterSpacing: 3,
    fontSize: 13,
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
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
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
    color: '#ffffff',
    letterSpacing: 1,
  },
  noticedSection: {
    marginTop: 32,
  },
  noticedLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 12,
  },
  noticedCard: {
    backgroundColor: '#111111',
    borderLeftWidth: 2,
    padding: 16,
    marginBottom: 10,
  },
  noticedEmptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 4,
  },
  noticedEmptyText: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  noticedFinding: {
    borderLeftColor: '#059669',
  },
  noticedQuestion: {
    borderLeftColor: '#D97706',
  },
  noticedFindingTag: {
    ...t.label,
    color: '#059669',
    letterSpacing: 2,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  noticedQuestionTag: {
    ...t.label,
    color: '#D97706',
    letterSpacing: 2,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  noticedText: {
    ...t.body,
    fontSize: 16,
    lineHeight: 23,
  },
  workoutHistSection: {
    marginTop: 32,
  },
  workoutHistLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 8,
  },
  workoutHistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  workoutHistInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workoutHistName: {
    fontFamily: fonts.primary.regular,
    fontSize: 14,
    color: '#e8e8e8',
    flex: 1,
  },
  workoutHistCount: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 1,
  },
  workoutHistRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutHistAvgLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#cdcdcd',
    letterSpacing: 2,
  },
  workoutHistAvgVal: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    letterSpacing: 1,
    minWidth: 40,
    textAlign: 'right',
  },
  notesSection: {
    marginTop: 32,
  },
  notesLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 8,
  },
  noteRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteMood: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 2,
  },
  noteDate: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#cdcdcd',
    letterSpacing: 1,
  },
  noteWorkoutName: {
    fontFamily: fonts.primary.regular,
    fontSize: 13,
    color: '#cdcdcd',
    marginBottom: 6,
  },
  noteText: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  recentSection: {
    marginTop: 32,
  },
  recentLabel: {
    ...t.label,
    color: '#ffffff',
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
    fontSize: 14,
  },
  recentLightBadge: {
    ...t.label,
    color: '#cdcdcd',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.5,
  },
  whatWorksSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
  },
  whatWorksLabel: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: 12,
  },
  whatWorksItem: {
    ...t.bodySm,
    color: '#d8d8d8',
    marginBottom: 8,
    lineHeight: 20,
  },
  historyUpsellRow: {
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  historyUpsellText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    fontSize: 13,
  },
  recentWorkout: {
    ...t.body,
    fontSize: 16,
  },
  recentDate: {
    ...t.timestamp,
    color: '#ffffff',
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
    color: '#cdcdcd',
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
    fontSize: 16,
  },
  burnConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  neverMind: {
    ...t.label,
    color: '#ffffff',
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
    color: '#ffffff',
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
    color: '#ffffff',
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
    color: '#ffffff',
    letterSpacing: 3,
    fontSize: 13,
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
    fontSize: 14,
  },
  casePanelDate: {
    ...t.timestamp,
    color: '#ffffff',
    letterSpacing: 2,
  },
  casePanelWorkoutName: {
    ...t.headlineSm,
    fontSize: 20,
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
    color: '#ffffff',
    letterSpacing: 2,
    fontSize: 13,
  },
  casePanelScoreVal: {
    ...t.dataValue,
    fontSize: 22,
  },
  casePanelScoreSep: {
    ...t.label,
    color: '#ffffff',
  },
  casePanelChange: {
    ...t.dataValue,
    fontSize: 22,
    marginLeft: 4,
  },
  casePanelRating: {
    ...t.label,
    letterSpacing: 2,
    fontSize: 13,
    marginBottom: 4,
  },
  caseNoteBox: {
    marginTop: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a',
    paddingLeft: 12,
    paddingVertical: 4,
  },
  caseNoteLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 5,
  },
  caseNoteText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#c5c5c5',
    lineHeight: 20,
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
    color: '#ffffff',
    letterSpacing: 2,
  },
  statValueSessions: {
    ...t.dataValue,
    color: colors.info,
  },
  statValueChange: {
    ...t.dataValue,
    color: colors.success,
  },
  statValueStreak: {
    ...t.dataValue,
    color: colors.warning,
  },
  healthCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#E11D48',
    padding: 14,
  },
  healthCardLabel: {
    ...t.label,
    color: '#d8d8d8',
    letterSpacing: 3,
    marginBottom: 10,
  },
  healthRow: {
    flexDirection: 'row',
    gap: 24,
  },
  healthStat: {
    flex: 1,
  },
  healthStatValue: {
    ...t.dataValue,
    fontSize: 22,
    color: colors.text,
  },
  healthStatLabel: {
    ...t.label,
    color: '#cdcdcd',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    letterSpacing: 1.5,
  },
  healthHint: {
    ...t.bodySm,
    color: '#cdcdcd',
    marginTop: 10,
  },
  healthSleepMissing: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.textSubtle,
    letterSpacing: 0.5,
    marginTop: 8,
    lineHeight: 17,
  },
  supplementBtn: {
    borderWidth: 1,
    borderColor: colors.textDim,
    paddingVertical: 12,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  supplementBtnText: {
    ...t.label,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  calendarWrap: {
    marginTop: 32,
  },
  recentChangeValue: {
    ...t.dataValue,
    fontSize: 18,
    fontFamily: fonts.mono.regular,
  },
  shareBtn: {
    borderWidth: 1,
    borderColor: colors.textDim,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginBottom: 12,
    marginTop: 32,
  },
  shareBtnText: {
    ...t.label,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
