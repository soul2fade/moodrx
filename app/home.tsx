import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { getStreak, getMoodIdentity, getUserProfile, getStreakState, saveStreakState, setLastCarouselPage, getLastCarouselPage, getGuidedSessionDone, hasSessionToday, consumeNavHintPending, setNavHintSeen, getVentEnabled, UserProfile } from '@/lib/storage';
import { rescheduleAfterSession } from '@/lib/notifications';
import { useSessions } from '@/contexts/SessionsContext';
import { getWorkoutsForMood } from '@/lib/workouts';
import { isYesterdayTimestamp, todayDateString } from '@/lib/dateUtils';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import type { MoodKey } from '@/lib/storage';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '@/lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BottomNav } from '@/components/BottomNav';
import { HomeCarousel } from '@/components/HomeCarousel';
import { IntensityPicker } from '@/components/IntensityPicker';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { getDrMoodRxLine } from '@/utils/dr-moodrx';
import { useBottomPanel } from '@/hooks/useBottomPanel';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';
import { createSessionId } from '@/lib/session-utils';
import { maybeRequestReview } from '@/lib/review';
import { captureSessionHealth } from '@/lib/health';
import { colors } from '@/lib/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PANEL_HEIGHT = Dimensions.get('window').height * 0.58;

let greetingShownThisSession = false;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, isLoading, streak, sessionCount, lastSession, addSession } = useSessions();
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [carouselPage, setCarouselPage] = useState<number | null>(null);
  const [showNavHint, setShowNavHint] = useState(false);
  const [ventEnabled, setVentLinkEnabled] = useState(true);
  const carouselFadeAnim = useRef(new Animated.Value(0)).current;
  const carouselVisible = carouselPage !== null;

  useEffect(() => {
    if (carouselVisible) {
      Animated.timing(carouselFadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [carouselVisible, carouselFadeAnim]);

  const { fadeAnim, slideAnim } = useScreenAnimation();
  const { buttonScale, onPressIn, onPressOut } = useButtonAnimation();
  const { panelAnim, backdropAnim, show: showPanel, dismiss: dismissPanelAnim } = useBottomPanel(PANEL_HEIGHT);
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingStreakLabel, setGreetingStreakLabel] = useState('');
  const [greetingStreakMsg, setGreetingStreakMsg] = useState('');
  const greetingAnim = useRef(new Animated.Value(0)).current;
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRescheduledSessionCountRef = useRef(-1);
  const moodAnims = useRef(
    MOOD_ORDER.map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(10) }))
  ).current;

  const dismissPanel = useCallback(() => {
    dismissPanelAnim(() => setSelectedMood(null));
  }, [dismissPanelAnim]);

  useFocusEffect(
    useCallback(() => {
      consumeNavHintPending().then((show) => {
        if (show) setShowNavHint(true);
      });
      Promise.all([getUserProfile(), getStreakState(), getLastCarouselPage()]).then(([profile, state, lastPage]) => {
        setUserProfile(profile);
        setCarouselPage(lastPage);
        const currentStreak = getStreak(sessions);
        const today = todayDateString();
        const MILESTONES = [3, 7, 14, 30];
        let updated = { ...state };
        if (currentStreak > state.hwm) {
          updated = { ...updated, hwm: currentStreak };
        }
        if (currentStreak === 0 && state.hwm >= 2 && state.lastBrokenDate !== today) {
          updated = { ...updated, lastBrokenDate: today, lastBrokenHwm: state.hwm };
        }

        // Hitting a streak milestone is a genuinely positive moment — ask for a
        // review. Gate on seenMilestones so a given milestone only ever triggers
        // once (the review module then applies its own global throttle on top).
        const seenMilestones = state.seenMilestones ?? [];
        if (MILESTONES.includes(currentStreak) && !seenMilestones.includes(currentStreak)) {
          updated = { ...updated, seenMilestones: [...seenMilestones, currentStreak] };
          void maybeRequestReview('streak-milestone');
        }

        if (JSON.stringify(updated) !== JSON.stringify(state)) saveStreakState(updated);

        // Show streak toast once per app launch (only for non-milestone active streaks)
        if (!greetingShownThisSession && currentStreak > 0 && !MILESTONES.includes(currentStreak)) {
          greetingShownThisSession = true;
          const label = `${currentStreak} DAY${currentStreak !== 1 ? 'S' : ''}`;
          const msg = currentStreak === 1
            ? "Day one. Don\u2019t let it be the only one."
            : currentStreak === 2
            ? "Two days straight. Something\u2019s clicking."
            : currentStreak < 7
            ? "You\u2019re on a roll. Don\u2019t blow it."
            : currentStreak < 14
            ? "Most people stop here. Don\u2019t be most people."
            : "You\u2019ve outlasted almost everyone.";
          setGreetingStreakLabel(label);
          setGreetingStreakMsg(msg);
          if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
          greetingAnim.setValue(0);
          setShowGreeting(true);
          Animated.timing(greetingAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          greetingTimerRef.current = setTimeout(() => {
            Animated.timing(greetingAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowGreeting(false));
          }, 3500);
        }
      });
      if (sessions.length !== lastRescheduledSessionCountRef.current) {
        lastRescheduledSessionCountRef.current = sessions.length;
        void rescheduleAfterSession(sessions);
      }
      dismissPanel();
      // Re-stagger mood rows on every focus
      moodAnims.forEach((anim) => {
        anim.opacity.setValue(0);
        anim.y.setValue(10);
      });
      moodAnims.forEach((anim, i) => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(anim.y,       { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start();
        }, 180 + i * 55);
      });
    }, [dismissPanel, sessions, greetingAnim, moodAnims])
  );

  useFocusEffect(
    useCallback(() => {
      getVentEnabled().then(setVentLinkEnabled).catch(() => {});
    }, []),
  );

  useEffect(() => {
    if (isLoading) return;
    void getGuidedSessionDone().then((done) => {
      if (!done && sessionCount === 0) {
        router.replace('/guided');
      }
    });
  }, [isLoading, sessionCount]);

  useEffect(() => {
    return () => {
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
    };
  }, []);

  const { moodIdentity } = useMemo(() => ({
    moodIdentity: getMoodIdentity(sessions),
  }), [sessions]);

  const drMoodRxLine = useMemo(
    () => (selectedMood ? getDrMoodRxLine(selectedMood, intensity) : ''),
    [selectedMood, intensity],
  );

  const checkedInToday = hasSessionToday(sessions);
  const accentColor = selectedMood ? MOODS[selectedMood].color : '#ffffff';
  const showStillFeeling = !isLoading && !selectedMood && lastSession != null && (Date.now() - lastSession.timestamp < 18 * 60 * 60 * 1000);
  const showSameAsYesterday = !isLoading && !checkedInToday && !selectedMood && lastSession != null && isYesterdayTimestamp(lastSession.timestamp);
  const { isPremium, isLoading: subLoading } = useSubscription();

  const handleDismissNavHint = useCallback(async () => {
    setShowNavHint(false);
    await setNavHintSeen();
  }, []);

  const handleMoodSelect = useCallback((mood: MoodKey) => {
    setSelectedMood(mood);
    setIntensity(5);
    showPanel();
  }, [showPanel]);

  const handleQuickSession = useCallback(() => {
    if (!moodIdentity) return;
    const workouts = getWorkoutsForMood(moodIdentity.dominantMood);
    if (workouts.length === 0) return;
    const pick = workouts[Math.floor(Math.random() * workouts.length)];
    router.push({
      pathname: '/workout',
      params: { mood: moodIdentity.dominantMood, workoutId: pick.id, intensity: '5' },
    });
  }, [moodIdentity]);

  const handleBadDay = useCallback(() => {
    router.push({
      pathname: '/bad-day',
      params: lastSession
        ? { mood: lastSession.mood, intensity: String(lastSession.intensity) }
        : {},
    });
  }, [lastSession]);

  const handleCarouselPageChange = useCallback((page: number) => {
    setCarouselPage(page);
    setLastCarouselPage(page);
  }, []);

  const handlePrescribe = useCallback(() => {
    if (!selectedMood) return;
    router.push({
      pathname: '/prescription',
      params: { mood: selectedMood, intensity: String(intensity) },
    });
  }, [selectedMood, intensity]);

  const handleJustLogIt = useCallback(async () => {
    if (!selectedMood) return;
    const health = await captureSessionHealth();
    const session = {
      id: createSessionId(),
      mood: selectedMood,
      intensity,
      postScore: intensity,
      workoutName: 'Mood check-in',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
      ...health,
    };
    await addSession(session);
    await rescheduleAfterSession([...sessions, session]);
    dismissPanel();
  }, [selectedMood, intensity, addSession, sessions, dismissPanel]);

  const handleSameAsYesterdayLog = useCallback(async () => {
    if (!lastSession) return;
    const health = await captureSessionHealth();
    const session = {
      id: createSessionId(),
      mood: lastSession.mood,
      intensity: lastSession.intensity,
      postScore: lastSession.intensity,
      workoutName: 'Same as yesterday',
      duration: 0,
      timestamp: Date.now(),
      lightDay: true as const,
      ...health,
    };
    await addSession(session);
    await rescheduleAfterSession([...sessions, session]);
  }, [lastSession, addSession, sessions]);

  const handleSameAsYesterdayRepeat = useCallback(() => {
    if (!lastSession) return;
    router.push({
      pathname: '/prescription',
      params: { mood: lastSession.mood, intensity: String(lastSession.intensity) },
    });
  }, [lastSession]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!selectedMood}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          {/* Render neither badge while subscription state is still loading,
              to avoid flashing "TRY PRO" at users who actually have Pro. */}
          {subLoading ? (
            <View style={styles.tryProBadge} />
          ) : !isPremium ? (
            <TouchableOpacity
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
              style={styles.tryProBadge}
              accessibilityRole="button"
              accessibilityLabel="Try Pro"
            >
              <Text style={styles.tryProBadgeText}>TRY PRO →</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.proMemberBadge}>
              <Text style={styles.proMemberBadgeText}>PRO</Text>
            </View>
          )}
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>
                {streak} DAY{streak !== 1 ? 'S' : ''}
              </Text>
            </View>
          )}
        </View>

        {showGreeting && (
          <Animated.View
            style={[
              styles.streakPill,
              {
                opacity: greetingAnim,
                transform: [{
                  translateY: greetingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 0],
                  }),
                }],
              },
            ]}
          >
            <Text style={styles.streakPillLabel}>{greetingStreakLabel}</Text>
            <Text style={styles.streakPillText}>{greetingStreakMsg}</Text>
            <TouchableOpacity
              onPress={() => {
                if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
                Animated.timing(greetingAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowGreeting(false));
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss streak message"
            >
              <Text style={styles.streakPillDismiss}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Text style={styles.headline}>
          {moodIdentity && sessions.length >= 10
            ? `Still ${MOODS[moodIdentity.dominantMood].name.toLowerCase()}? Let\u2019s fix that.`
            : 'Alright. How bad is it?'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>Be honest. I&apos;m not here to judge. Much.</Text>

        {/* 3-page carousel: Today / Your Pattern / Quick Actions */}
        <View style={styles.carouselPlaceholder}>
          {carouselPage === null ? (
            <View style={styles.skeletonWrapper}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, styles.skeletonLineSm]} />
              <View style={[styles.skeletonLine, styles.skeletonLineMd]} />
              <View style={styles.skeletonDots}>
                <View style={[styles.skeletonDot, styles.skeletonDotActive]} />
                <View style={styles.skeletonDot} />
                <View style={styles.skeletonDot} />
              </View>
            </View>
          ) : (
            <Animated.View style={{ opacity: carouselFadeAnim, flex: 1 }}>
              <HomeCarousel
                selectedMood={selectedMood}
                sessionCount={sessionCount}
                userProfile={userProfile}
                lastSession={lastSession}
                showStillFeeling={showStillFeeling}
                moodIdentity={moodIdentity}
                sessions={sessions}
                onQuickSession={handleQuickSession}
                initialPage={carouselPage}
                onPageChange={handleCarouselPageChange}
              />
            </Animated.View>
          )}
        </View>

        {/* Mood list */}
        <View style={styles.moodList} accessibilityRole="radiogroup" accessibilityLabel="Select your mood">
          {MOOD_ORDER.map((moodKey, idx) => {
            const mood = MOODS[moodKey];
            const isSelected = selectedMood === moodKey;
            return (
              <Animated.View
                key={moodKey}
                style={{ opacity: moodAnims[idx].opacity, transform: [{ translateY: moodAnims[idx].y }] }}
              >
              <TouchableOpacity
                style={isSelected
                  ? flattenStyle([styles.moodRow, styles.moodRowSelected, { borderLeftColor: mood.color }])
                  : styles.moodRow}
                onPress={() => handleMoodSelect(moodKey)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${mood.name}: ${mood.description}`}
              >
                <MoodIcon
                  mood={moodKey}
                  size={32}
                  opacity={isSelected ? 1 : 0.65}
                  color={mood.color}
                />
                <View style={styles.moodTextBlock}>
                  <Text style={styles.moodName}>{mood.name}</Text>
                  <Text style={[styles.moodDesc, { color: mood.color }]}>{mood.description}</Text>
                </View>
                <View style={styles.moodRight}>
                  <Text style={styles.moodCode}>{mood.code}</Text>
                  {isSelected && (
                    <Text style={[styles.moodChevron, { color: mood.color }]}>{'>'}</Text>
                  )}
                </View>
              </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {!isLoading && !selectedMood && !checkedInToday && (
          <TouchableOpacity
            style={styles.badDayButton}
            onPress={handleBadDay}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Bad day minimum workout, two minutes"
          >
            <Text style={styles.badDayText}>I CAN&apos;T TODAY — 2 MIN MINIMUM →</Text>
          </TouchableOpacity>
        )}

        {showSameAsYesterday && lastSession && (
          <View style={[styles.sameDayCard, { borderLeftColor: MOODS[lastSession.mood].color }]}>
            <Text style={styles.sameDayLabel}>SAME AS YESTERDAY?</Text>
            <Text style={styles.sameDaySub}>
              {MOODS[lastSession.mood].name.toUpperCase()} · {lastSession.intensity}/10
            </Text>
            <View style={styles.sameDayActions}>
              <TouchableOpacity
                onPress={handleSameAsYesterdayLog}
                style={styles.sameDayBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Log same mood as yesterday without a workout"
              >
                <Text style={styles.sameDayBtnText}>JUST LOG IT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSameAsYesterdayRepeat}
                style={styles.sameDayBtnOutline}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Repeat yesterday's workout prescription"
              >
                <Text style={styles.sameDayBtnOutlineText}>REPEAT →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Vent tool link */}
        {ventEnabled && (
          <TouchableOpacity
            onPress={() => router.push('/vent' as Href)}
            activeOpacity={0.6}
            style={styles.breatheLink}
            accessibilityRole="button"
            accessibilityLabel="Open voice venting"
          >
            <Text style={styles.breatheLinkText}>Need to vent? →</Text>
          </TouchableOpacity>
        )}

        {/* Breathe tool link */}
        <TouchableOpacity
          onPress={() => router.push('/breathe' as Href)}
          activeOpacity={0.6}
          style={styles.breatheLink}
          accessibilityRole="button"
          accessibilityLabel="Open box breathing tool"
        >
          <Text style={styles.breatheLinkText}>Need to breathe first? →</Text>
        </TouchableOpacity>

        {/* Safety net link */}
        <TouchableOpacity
          onPress={() => router.push('/crisis' as Href)}
          activeOpacity={0.6}
          style={styles.safetyNetBtn}
          accessibilityRole="button"
          accessibilityLabel="Not okay enough to move? Get crisis support"
        >
          <Text style={styles.safetyNetText}>Not okay enough to move? →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={selectedMood ? 'auto' : 'none'}
      >
        <TouchableWithoutFeedback
          onPress={dismissPanel}
          accessibilityLabel="Dismiss mood panel"
          accessibilityRole="button"
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Slide-up panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateY: panelAnim }], paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {selectedMood && (
          <>
            {/* Panel handle + mood name */}
            <View style={styles.panelHeader}>
              <View style={styles.panelHandle} />
              <View style={[styles.panelMoodTag, { borderColor: accentColor }]}>
                <Text style={[styles.panelMoodName, { color: accentColor }]}>
                  {MOODS[selectedMood].name.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Dr. MoodRx says */}
            <View style={flattenStyle([styles.drBox, { borderLeftColor: accentColor }])}>
              <Text style={styles.drLabel}>DR. MOODRX SAYS</Text>
              <Text style={styles.drText}>{drMoodRxLine}</Text>
            </View>

            {/* Intensity */}
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>INTENSITY</Text>
              <View style={styles.intensityValueRow}>
                <Text style={[styles.intensityValue, { color: accentColor }]}>{intensity}</Text>
                <Text style={styles.intensityMax}>/10</Text>
              </View>
            </View>
            <IntensityPicker
              value={intensity}
              onChange={setIntensity}
              accentColor={accentColor}
            />

            <TouchableOpacity
              onPress={handleJustLogIt}
              activeOpacity={0.7}
              style={styles.justLogButton}
              accessibilityRole="button"
              accessibilityLabel="Log mood without a workout"
            >
              <Text style={styles.justLogButtonText}>JUST LOG IT — NO WORKOUT</Text>
            </TouchableOpacity>

            {/* Prescribe button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={flattenStyle([styles.prescribeButton, { borderColor: accentColor }])}
                onPress={handlePrescribe}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Get workout prescription"
              >
                <Text style={flattenStyle([styles.prescribeButtonText, { color: accentColor }])}>
                  PRESCRIBE ME SOMETHING →
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </Animated.View>

      {showNavHint && (
        <View style={styles.navHintPill}>
          <Text style={styles.navHintText}>Insights · Supps · Settings live in the bar below</Text>
          <TouchableOpacity
            onPress={handleDismissNavHint}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Dismiss navigation hint"
          >
            <Text style={styles.navHintDismiss}>GOT IT</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomNav />
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
    paddingTop: 80,
    paddingBottom: 80,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tryProBadge: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tryProBadgeText: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  proMemberBadge: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proMemberBadgeText: {
    ...t.label,
    color: colors.premium,
    letterSpacing: 2,
    fontSize: 16,
    lineHeight: 17,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  streakPillLabel: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 2,
    fontSize: 16,
    lineHeight: 17,
  },
  streakPillText: {
    ...t.bodySm,
    color: '#d8d8d8',
    flex: 1,
    fontSize: 16,
  },
  streakPillDismiss: {
    ...t.label,
    color: '#f0f0f0',
    fontSize: 16,
    lineHeight: 17,
  },
  streakBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakBadgeText: {
    ...t.number,
    color: colors.accent,
    fontSize: 16,
    lineHeight: 17,
    letterSpacing: 1,
  },
  headline: {
    ...t.headline,
    marginTop: 36,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#525252',
    marginTop: 12,
  },
  subtext: {
    ...t.bodyMuted,
    fontSize: 18,
    color: '#e2e2e2',
    marginTop: 12,
  },
  breatheLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  breatheLinkText: {
    fontFamily: fonts.mono.regular,
    fontSize: 18,
    color: '#7EC8A0',
    letterSpacing: 1,
  },
  safetyNetBtn: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  safetyNetText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.6,
    letterSpacing: 0.5,
  },
  carouselPlaceholder: {
    marginTop: 16,
    height: 212,
  },
  skeletonWrapper: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 2,
    backgroundColor: '#161616',
    marginBottom: 10,
    width: '72%',
  },
  skeletonLineSm: {
    width: '45%',
    height: 10,
  },
  skeletonLineMd: {
    width: '58%',
    height: 10,
  },
  skeletonDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
  },
  skeletonDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e1e1e',
  },
  skeletonDotActive: {
    width: 14,
    backgroundColor: '#252525',
  },
  moodList: {
    marginTop: 28,
  },
  badDayButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  badDayText: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  sameDayCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderLeftWidth: 3,
    padding: 14,
  },
  sameDayLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  sameDaySub: {
    ...t.bodySm,
    color: '#cdcdcd',
    marginTop: 6,
    fontSize: 16,
  },
  sameDayActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sameDayBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  sameDayBtnText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  sameDayBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  sameDayBtnOutlineText: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  justLogButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  justLogButtonText: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  navHintPill: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navHintText: {
    ...t.bodySm,
    color: '#d8d8d8',
    flex: 1,
    fontSize: 16,
    lineHeight: 18,
  },
  navHintDismiss: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  moodRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    minHeight: 72,
  },
  moodRowSelected: {
    borderLeftWidth: 2,
    backgroundColor: '#111111',
    paddingLeft: 14,
  },
  moodTextBlock: {
    flex: 1,
    marginLeft: 12,
  },
  moodName: {
    ...t.headlineSm,
    fontSize: 19,
  },
  moodDesc: {
    ...t.label,
    color: '#e2e2e2',
    marginTop: 2,
  },
  moodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moodCode: {
    ...t.code,
    color: '#ffffff',
  },
  moodChevron: {
    fontSize: 16,
    fontFamily: fonts.primary.bold,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  panelHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  panelHandle: {
    width: 36,
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 14,
  },
  panelMoodTag: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  panelMoodName: {
    ...t.label,
    letterSpacing: 3,
    fontSize: 16,
  },
  drBox: {
    borderLeftWidth: 3,
    backgroundColor: '#0a0a0a',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  drLabel: {
    ...t.label,
    color: '#e2e2e2',
    letterSpacing: 2,
  },
  drText: {
    ...t.soft,
    color: '#ffffff',
    marginTop: 6,
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  intensityLabel: {
    ...t.label,
    color: '#ffffff',
  },
  intensityValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  intensityValue: {
    ...t.dataValue,
    fontSize: 27,
  },
  intensityMax: {
    ...t.bodyMuted,
    color: '#ffffff',
    fontSize: 18,
    marginLeft: 3,
  },
  prescribeButton: {
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 0,
  },
  prescribeButtonText: {
    ...t.timer,
    fontSize: 16,
  },
});
