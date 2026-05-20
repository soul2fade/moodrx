import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolate,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { MOODS } from '@/lib/moods';
import { fonts } from '@/lib/typography';
import type { MoodKey, Session, UserProfile } from '@/lib/storage';
import { getCarouselHintSeen, setCarouselHintSeen } from '@/lib/storage';

const SCREEN_W = Dimensions.get('window').width;
const H_PADDING = 24;
const CARD_W = SCREEN_W - H_PADDING * 2;

interface MoodIdentity {
  dominantMood: MoodKey;
  label: string;
  sessionCount: number;
}

interface HomeCarouselProps {
  selectedMood: MoodKey | null;
  sessionCount: number;
  userProfile: UserProfile;
  lastSession: Session | null;
  showStillFeeling: boolean;
  moodIdentity: MoodIdentity | null;
  sessions: Session[];
  onQuickSession: () => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

const DOT_INACTIVE_W = 6;
const DOT_ACTIVE_W = 16;

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
  selectedMood,
  sessionCount,
  userProfile,
  lastSession,
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

  const patternDotColor = useSharedValue(
    moodIdentity ? MOODS[moodIdentity.dominantMood].color : '#525252',
  );
  const quickActionsDotColor = useSharedValue('#059669');
  const hintOpacity = useSharedValue(0);
  const hintDismissed = useRef(false);

  useEffect(() => {
    patternDotColor.value = moodIdentity ? MOODS[moodIdentity.dominantMood].color : '#525252';
  }, [moodIdentity]);

  const dismissHint = useCallback(() => {
    if (hintDismissed.current) return;
    hintDismissed.current = true;
    hintOpacity.value = withTiming(0, { duration: 400 });
    setCarouselHintSeen();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) return; // only show to brand-new users
    let timer: ReturnType<typeof setTimeout> | null = null;
    getCarouselHintSeen().then((seen) => {
      if (!seen) {
        hintOpacity.value = withTiming(1, { duration: 300 });
        timer = setTimeout(dismissHint, 3000);
      }
    });
    return () => { if (timer) clearTimeout(timer); };
  }, []);

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

  const PAGE_LABELS = ['YOUR PATTERN', 'QUICK ACTIONS'];

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const labelSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: labelTranslateX.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));

  const label0Style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, CARD_W], [1, 0], Extrapolate.CLAMP),
    position: 'absolute',
  }));

  const label1Style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, CARD_W], [0, 1], Extrapolate.CLAMP),
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
        onScrollBeginDrag={dismissHint}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
      >
        {/* ── PAGE 1: YOUR PATTERN ── */}
        <View style={styles.page} accessibilityRole="tab" accessibilityLabel="Page 1: Your Pattern">
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
                const trendColor = Math.abs(diff) < 1 ? '#999999' : diff < 0 ? '#059669' : '#b45309';
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

        {/* ── PAGE 2: QUICK ACTIONS ── */}
        <View style={styles.page} accessibilityRole="tab" accessibilityLabel="Page 2: Quick Actions">
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
                  <Text style={styles.quickRowIcon}>›</Text>
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
            const animStyle = i === 0 ? label0Style : label1Style;
            return (
              <Animated.Text key={label} style={[styles.pageLabel, animStyle]}>
                {label}
              </Animated.Text>
            );
          })}
        </Animated.View>
        <View style={styles.dots}>
          {[
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
      <Animated.View style={[styles.swipeHintRow, hintStyle]} pointerEvents="none">
        <Text style={styles.swipeHintText}>SWIPE TO EXPLORE →</Text>
      </Animated.View>
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
    width: CARD_W * 2,
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
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 17,
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
  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 2,
  },
  emptyStateLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 6,
    lineHeight: 17,
  },
  emptyStateText: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
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
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 17,
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
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
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
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 6,
    lineHeight: 17,
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
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 6,
    lineHeight: 17,
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
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 17,
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
  swipeHintRow: {
    alignItems: 'center',
    marginTop: 6,
  },
  swipeHintText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    lineHeight: 17,
  },
});
