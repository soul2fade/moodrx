import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolate,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { MOODS } from '@/lib/moods';
import { fonts } from '@/lib/typography';
import type { MoodKey, Session, StreakState, UserProfile } from '@/lib/storage';
import { todayDateString } from '@/lib/dateUtils';

const DAILY_OPENERS = [
  { day: 'SUNDAY',    line: "The day before Monday. Use it wisely." },
  { day: 'MONDAY',    line: "Statistically the worst day. Let\u2019s work with that." },
  { day: 'TUESDAY',   line: "The most forgettable day of the week. Make it count." },
  { day: 'WEDNESDAY', line: "Halfway through. You\u2019re still here." },
  { day: 'THURSDAY',  line: "Almost Friday. Almost." },
  { day: 'FRIDAY',    line: "You made it. Now check in before you celebrate." },
  { day: 'SATURDAY',  line: "The one day you have no excuse not to." },
];

const SCREEN_W = Dimensions.get('window').width;
const H_PADDING = 24;
const CARD_W = SCREEN_W - H_PADDING * 2;

interface MoodIdentity {
  dominantMood: MoodKey;
  label: string;
  sessionCount: number;
}

interface HomeCarouselProps {
  showHint: boolean;
  selectedMood: MoodKey | null;
  onDismissHint: () => void;
  sessionCount: number;
  userProfile: UserProfile;
  streak: number;
  streakState: StreakState;
  onMilestoneDismiss: (day: number) => void;
  showWelcomeBack: boolean;
  lastSession: Session | null;
  daysSinceLastSession: number | null;
  showStillFeeling: boolean;
  moodIdentity: MoodIdentity | null;
  sessions: Session[];
  onQuickSession: () => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

const DOT_INACTIVE_W = 5;
const DOT_ACTIVE_W = 14;

function AnimatedDot({
  index,
  scrollX,
  isActive,
  onPress,
  label,
  accentColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  isActive: boolean;
  onPress: () => void;
  label: string;
  accentColor: SharedValue<string>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [(index - 1) * CARD_W, index * CARD_W, (index + 1) * CARD_W],
      [0, 1, 0],
      Extrapolate.CLAMP,
    );
    return {
      width: progress * (DOT_ACTIVE_W - DOT_INACTIVE_W) + DOT_INACTIVE_W,
      backgroundColor: interpolateColor(progress, [0, 1], ['#2a2a2a', accentColor.value]),
    };
  });

  return (
    <View style={styles.dotSlot}>
      <TouchableOpacity
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
      >
        <Animated.View style={[styles.dotBase, animStyle]} />
      </TouchableOpacity>
    </View>
  );
}

export function HomeCarousel({
  showHint,
  selectedMood,
  onDismissHint,
  sessionCount,
  userProfile,
  streak,
  streakState,
  onMilestoneDismiss,
  showWelcomeBack,
  lastSession,
  daysSinceLastSession,
  showStillFeeling,
  moodIdentity,
  sessions,
  onQuickSession,
  initialPage = 0,
  onPageChange,
}: HomeCarouselProps) {
  const [activePage, setActivePage] = useState(initialPage);
  const scrollX = useSharedValue(initialPage * CARD_W);
  const labelTranslateX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const prevInitialPage = useRef(initialPage);
  const swipeDir = useRef<1 | -1>(1);

  const todayDotColor = useSharedValue('#D97706');
  const patternDotColor = useSharedValue(
    moodIdentity ? MOODS[moodIdentity.dominantMood].color : '#525252',
  );
  const quickActionsDotColor = useSharedValue('#059669');

  useEffect(() => {
    patternDotColor.value = moodIdentity ? MOODS[moodIdentity.dominantMood].color : '#525252';
  }, [moodIdentity]);

  useEffect(() => {
    if (initialPage === 0) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialPage * CARD_W, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialPage === prevInitialPage.current) return;
    prevInitialPage.current = initialPage;
    setActivePage(initialPage);
    scrollX.value = initialPage * CARD_W;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialPage * CARD_W, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [initialPage]);

  useEffect(() => {
    labelTranslateX.value = swipeDir.current * 10;
    labelTranslateX.value = withSpring(0, { damping: 12, stiffness: 180, mass: 0.6 });
  }, [activePage]);

  const PAGE_LABELS = ['TODAY', 'YOUR PATTERN', 'QUICK ACTIONS'];

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const labelSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: labelTranslateX.value }],
  }));

  const label0Style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, CARD_W], [1, 0], Extrapolate.CLAMP),
    position: 'absolute',
  }));

  const label1Style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, CARD_W, CARD_W * 2], [0, 1, 0], Extrapolate.CLAMP),
    position: 'absolute',
  }));

  const label2Style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [CARD_W, CARD_W * 2], [0, 1], Extrapolate.CLAMP),
    position: 'absolute',
  }));

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    if (page !== activePage) {
      swipeDir.current = page > activePage ? 1 : -1;
      setActivePage(page);
      onPageChange?.(page);
    }
  };

  const goToPage = (index: number) => {
    swipeDir.current = index > activePage ? 1 : -1;
    scrollX.value = index * CARD_W;
    scrollRef.current?.scrollTo({ x: index * CARD_W, animated: false });
    setActivePage(index);
    onPageChange?.(index);
  };

  const hasQuickActions =
    (moodIdentity != null && !selectedMood) ||
    (sessionCount >= 3 && !selectedMood) ||
    (showStillFeeling && lastSession != null);

  return (
    <View style={styles.wrapper}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
      >
        {/* ── PAGE 1: TODAY ── */}
        <View style={styles.page} accessibilityRole="tab" accessibilityLabel="Page 1: Today">
          <ScrollView showsVerticalScrollIndicator={false} style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
          {/* Daily opener — always shown */}
          <View style={styles.dailyOpener}>
            <Text style={styles.dailyOpenerLabel}>{DAILY_OPENERS[new Date().getDay()].day}</Text>
            <Text style={styles.dailyOpenerText}>{DAILY_OPENERS[new Date().getDay()].line}</Text>
          </View>

          {/* Onboarding hint */}
          {showHint && !selectedMood && (
            <View style={styles.hintBanner} accessibilityRole="none">
              <Text style={styles.hintText}>TAP A MOOD BELOW TO START →</Text>
              <TouchableOpacity
                onPress={onDismissHint}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss hint"
              >
                <Text style={styles.hintDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Streak broken */}
          {streak === 0 && streakState.lastBrokenDate === todayDateString() && streakState.lastBrokenHwm >= 2 && (
            <View style={styles.streakBrokenBox}>
              <Text style={styles.streakBrokenLabel}>STREAK LOST</Text>
              <Text style={styles.streakBrokenCount}>{streakState.lastBrokenHwm}</Text>
              <Text style={styles.streakBrokenDays}>
                {streakState.lastBrokenHwm === 1 ? 'day' : 'days'} gone.
              </Text>
              <Text style={styles.streakBrokenSub}>
                {streakState.lastBrokenHwm >= 14
                  ? 'That was real momentum. You stopped.'
                  : streakState.lastBrokenHwm >= 7
                  ? 'A whole week. You walked away from it.'
                  : streakState.lastBrokenHwm >= 4
                  ? 'You were building something. Now you\u2019re not.'
                  : 'Two days in and you quit. Impressive.'}
              </Text>
            </View>
          )}

          {/* Streak milestone */}
          {streak > 0 && [3, 7, 14, 30].includes(streak) && !(streakState.seenMilestones ?? []).includes(streak) && (
            <View style={[styles.streakMilestoneBox, { borderLeftColor: '#D97706' }]}>
              <TouchableOpacity
                onPress={() => onMilestoneDismiss(streak)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.milestoneDismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss milestone"
              >
                <Text style={styles.milestoneDismissText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.streakMilestoneNum}>{streak} DAYS</Text>
              <Text style={styles.streakMilestoneMsg}>
                {streak === 3
                  ? 'Three days. A habit is forming. Don\u2019t ruin it.'
                  : streak === 7
                  ? 'One week straight. That\u2019s genuinely rare.'
                  : streak === 14
                  ? 'Two weeks. You\u2019ve crossed a line most people never reach.'
                  : '30 days. This is who you are now.'}
              </Text>
            </View>
          )}

          {/* Welcome back nudge */}
          {showWelcomeBack && lastSession !== null && daysSinceLastSession !== null && (
            <TouchableOpacity
              style={styles.welcomeBackBanner}
              onPress={() => router.push('/insights')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Welcome back. ${daysSinceLastSession === 1 ? '1 day' : `${daysSinceLastSession} days`} since your last check-in.`}
            >
              <Text style={styles.welcomeBackText}>
                {daysSinceLastSession === 1
                  ? `Yesterday you were ${MOODS[lastSession.mood].name.toUpperCase()}. Today?`
                  : `${daysSinceLastSession} days since your last check-in. What changed?`}
              </Text>
              <Text style={styles.welcomeBackArrow}> →</Text>
            </TouchableOpacity>
          )}

          {/* Prescription evolving */}
          {sessionCount >= 3 && !selectedMood && (userProfile.preferredTime || userProfile.primaryGoal) && (
            <View style={styles.prescriptionEvolvingRow} accessibilityLabel="Your prescription is personalizing">
              <Text style={styles.prescriptionEvolvingLabel}>PRESCRIPTION EVOLVING</Text>
              <Text style={styles.prescriptionEvolvingValue}>
                {[userProfile.preferredTime, userProfile.primaryGoal].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          </ScrollView>
        </View>

        {/* ── PAGE 2: YOUR PATTERN ── */}
        <View style={styles.page} accessibilityRole="tab" accessibilityLabel="Page 2: Your Pattern">
          <ScrollView showsVerticalScrollIndicator={false} style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
          {sessions.length >= 5 && moodIdentity ? (
            <>
              {/* Mood identity card */}
              <TouchableOpacity
                style={styles.identityRow}
                onPress={() => router.push('/insights')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Your pattern: ${moodIdentity.label}, ${moodIdentity.sessionCount} sessions`}
              >
                <Text style={styles.identityLabel}>YOUR PATTERN</Text>
                <Text style={[styles.identityValue, { color: MOODS[moodIdentity.dominantMood].color }]}>
                  {moodIdentity.label.toUpperCase()}
                </Text>
                <Text style={styles.identityCount}>{moodIdentity.sessionCount} sessions logged →</Text>
              </TouchableOpacity>

              {/* 7-day sparkline */}
              {sessions.length >= 2 && (() => {
                const last7 = sessions.slice(-7);
                const maxVal = 10;
                const SPARK_H = 32;
                const first = last7[0].intensity;
                const last = last7[last7.length - 1].intensity;
                const diff = last - first;
                const trendLabel = Math.abs(diff) < 1
                  ? '→ HOLDING STEADY'
                  : diff < 0
                  ? '↓ TRENDING BETTER'
                  : '↑ TRENDING WORSE';
                const trendColor = Math.abs(diff) < 1 ? '#525252' : diff < 0 ? '#059669' : '#b45309';
                return (
                  <View style={styles.sparklineCard} accessibilityLabel={`7-day mood trend: ${trendLabel}`}>
                    <Text style={styles.sparklineHeader}>7-DAY TREND</Text>
                    <View style={styles.sparklineBars}>
                      {last7.map((s, i) => {
                        const barH = Math.max((s.intensity / maxVal) * SPARK_H, 3);
                        const moodCol = MOODS[s.mood]?.color ?? '#525252';
                        return (
                          <View
                            key={s.id ?? i}
                            style={[styles.sparklineBar, { height: barH, backgroundColor: moodCol + 'aa' }]}
                            importantForAccessibility="no"
                          />
                        );
                      })}
                    </View>
                    <Text style={[styles.sparklineTrend, { color: trendColor }]}>{trendLabel}</Text>
                  </View>
                );
              })()}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateLabel}>YOUR PATTERN</Text>
              <Text style={styles.emptyStateText}>
                Appears after 5 sessions.{'\n'}
                {sessions.length > 0 ? `${5 - Math.min(sessions.length, 5)} more to go.` : 'Start tracking below.'}
              </Text>
            </View>
          )}
          </ScrollView>
        </View>

        {/* ── PAGE 3: QUICK ACTIONS ── */}
        <View style={styles.page} accessibilityRole="tab" accessibilityLabel="Page 3: Quick Actions">
          <ScrollView showsVerticalScrollIndicator={false} style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
          {hasQuickActions ? (
            <>
              {/* Adaptive shortcut — Quick Repeat takes priority when within 18hr window, else Quick Session */}
              {showStillFeeling && lastSession ? (
                <TouchableOpacity
                  style={[styles.quickRow, { borderLeftColor: MOODS[lastSession.mood].color }]}
                  onPress={() => router.push({ pathname: '/prescription', params: { mood: lastSession.mood, intensity: String(lastSession.intensity) } })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Last time you felt ${MOODS[lastSession.mood].name}. Tap to repeat.`}
                >
                  <View style={styles.quickRowLeft}>
                    <Text style={styles.quickRowLabel}>LAST SESSION</Text>
                    <Text style={styles.quickRowSub}>
                      Still {MOODS[lastSession.mood].name.toUpperCase()}? Start where you left off.
                    </Text>
                  </View>
                  <Text style={styles.quickRowIcon}>→</Text>
                </TouchableOpacity>
              ) : moodIdentity && !selectedMood ? (
                <TouchableOpacity
                  style={[styles.quickRow, { borderLeftColor: MOODS[moodIdentity.dominantMood].color }]}
                  onPress={onQuickSession}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick session: random ${MOODS[moodIdentity.dominantMood].name} workout`}
                >
                  <View style={styles.quickRowLeft}>
                    <Text style={styles.quickRowLabel}>QUICK SESSION</Text>
                    <Text style={[styles.quickRowSub, { color: MOODS[moodIdentity.dominantMood].color }]}>
                      Random {MOODS[moodIdentity.dominantMood].name.toUpperCase()} workout →
                    </Text>
                  </View>
                  <Text style={styles.quickRowIcon}>⚡</Text>
                </TouchableOpacity>
              ) : null}

              {/* Weekly Rx */}
              {sessionCount >= 3 && !selectedMood && (
                <TouchableOpacity
                  style={styles.quickRow}
                  onPress={() => router.push('/weekly-prescription' as any)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="View your weekly prescription"
                >
                  <View style={styles.quickRowLeft}>
                    <Text style={styles.quickRowLabel}>WEEKLY RX</Text>
                    <Text style={styles.quickRowSub}>Your 7-day plan is ready</Text>
                  </View>
                  <Text style={styles.quickRowIcon}>→</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateLabel}>QUICK ACTIONS</Text>
              <Text style={styles.emptyStateText}>Log a few sessions to unlock shortcuts.</Text>
            </View>
          )}
          </ScrollView>
        </View>
      </Animated.ScrollView>

      {/* Page label + dot indicators */}
      <View style={styles.dotsRow} accessibilityRole="none" importantForAccessibility="no">
        <Animated.View style={[styles.pageLabelContainer, labelSlideStyle]}>
          {PAGE_LABELS.map((label, i) => {
            const animStyle = i === 0 ? label0Style : i === 1 ? label1Style : label2Style;
            return (
              <Animated.Text key={label} style={[styles.pageLabel, animStyle]}>
                {label}
              </Animated.Text>
            );
          })}
        </Animated.View>
        <View style={styles.dots}>
          {[
            { label: 'Today', accentColor: todayDotColor },
            { label: 'Your Pattern', accentColor: patternDotColor },
            { label: 'Quick Actions', accentColor: quickActionsDotColor },
          ].map(({ label, accentColor }, i) => (
            <AnimatedDot
              key={i}
              index={i}
              scrollX={scrollX}
              isActive={activePage === i}
              onPress={() => goToPage(i)}
              label={label}
              accentColor={accentColor}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  scrollView: {
    width: CARD_W,
    height: 190,
  },
  scrollContent: {
    width: CARD_W * 3,
    height: 190,
  },
  page: {
    width: CARD_W,
    height: 190,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingBottom: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  pageLabelContainer: {
    position: 'relative',
    height: 12,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 14,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotSlot: {
    width: DOT_ACTIVE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotBase: {
    height: 5,
    borderRadius: 3,
  },
  dailyOpener: {
    paddingBottom: 20,
    paddingHorizontal: 2,
  },
  dailyOpenerLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 6,
    lineHeight: 15,
  },
  dailyOpenerText: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 2,
  },
  emptyStateLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 6,
    lineHeight: 15,
  },
  emptyStateText: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0c0c0c',
  },
  hintText: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 16,
  },
  hintDismiss: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#333',
    lineHeight: 16,
  },
  streakBrokenBox: {
    borderWidth: 1,
    borderColor: '#3a1010',
    backgroundColor: '#0d0808',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  streakBrokenLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#8b2020',
    letterSpacing: 4,
    marginBottom: 4,
    lineHeight: 16,
  },
  streakBrokenCount: {
    fontFamily: fonts.mono.regular,
    fontSize: 40,
    color: '#5a1515',
    lineHeight: 44,
  },
  streakBrokenDays: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#5a1515',
    letterSpacing: 2,
    marginBottom: 6,
  },
  streakBrokenSub: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#7a2020',
    textAlign: 'center',
    lineHeight: 18,
  },
  streakMilestoneBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingTop: 8,
    paddingBottom: 12,
    paddingRight: 16,
    backgroundColor: '#0d0d00',
    marginBottom: 8,
  },
  milestoneDismiss: {
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  milestoneDismissText: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#444',
    lineHeight: 16,
  },
  streakMilestoneNum: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#D97706',
    letterSpacing: 3,
    marginBottom: 4,
    lineHeight: 18,
  },
  streakMilestoneMsg: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#e8e8e8',
    lineHeight: 22,
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0f0f0f',
    marginBottom: 8,
  },
  welcomeBackText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 1,
    flex: 1,
    lineHeight: 18,
  },
  welcomeBackArrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#D97706',
    lineHeight: 18,
  },
  prescriptionEvolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  prescriptionEvolvingLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#059669',
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    lineHeight: 15,
  },
  prescriptionEvolvingValue: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    lineHeight: 15,
  },
  identityRow: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0d0d0d',
    marginBottom: 8,
  },
  identityLabel: {
    fontFamily: fonts.mono.regular,
    color: '#ffffff',
    letterSpacing: 3,
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 15,
  },
  identityValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.primary.bold,
    letterSpacing: 1,
  },
  identityCount: {
    fontFamily: fonts.mono.regular,
    color: '#ffffff',
    letterSpacing: 1,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  sparklineCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sparklineHeader: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 6,
    lineHeight: 15,
  },
  sparklineBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 32,
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 1,
  },
  sparklineTrend: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 6,
    lineHeight: 15,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#333333',
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#0a0a0a',
  },
  quickRowLeft: {
    flex: 1,
    gap: 2,
  },
  quickRowLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 15,
  },
  quickRowSub: {
    fontFamily: fonts.primary.regular,
    fontSize: 14,
    color: '#ffffff',
  },
  quickRowIcon: {
    fontSize: 16,
    marginLeft: 8,
    color: '#ffffff',
  },
});
