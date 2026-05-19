import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { getSessions, getStreak, getMoodIdentity, getUserProfile, getStreakState, saveStreakState, getHomeHintSeen, setHomeHintSeen, UserProfile, Session, StreakState } from '@/lib/storage';
import { getWorkoutsForMood } from '@/lib/workouts';
import { todayDateString } from '@/lib/dateUtils';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import type { MoodKey } from '@/lib/storage';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '@/lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BottomNav } from '@/components/BottomNav';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useBottomPanel } from '@/hooks/useBottomPanel';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';

const PANEL_HEIGHT = Dimensions.get('window').height * 0.52;

let greetingShownThisSession = false;

export default function HomeScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [streakState, setStreakState] = useState<StreakState>({ hwm: 0, lastBrokenDate: null, lastBrokenHwm: 0 });

  const { fadeAnim, slideAnim } = useScreenAnimation();
  const { buttonScale, onPressIn, onPressOut } = useButtonAnimation();
  const { panelAnim, backdropAnim, show: showPanel, dismiss: dismissPanelAnim } = useBottomPanel(PANEL_HEIGHT);
  const [showHint, setShowHint] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingStreakLabel, setGreetingStreakLabel] = useState('');
  const [greetingStreakMsg, setGreetingStreakMsg] = useState('');
  const greetingAnim = useRef(new Animated.Value(0)).current;
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodAnims = useRef(
    MOOD_ORDER.map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(10) }))
  ).current;

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      getHomeHintSeen().then(seen => { if (!seen) setShowHint(true); });
      Promise.all([getSessions(), getUserProfile(), getStreakState()]).then(([data, profile, state]) => {
        setSessions(data);
        setUserProfile(profile);
        setIsLoading(false);
        const currentStreak = getStreak(data);
        const today = todayDateString();
        let updated = { ...state };
        if (currentStreak > state.hwm) {
          updated = { ...updated, hwm: currentStreak };
        }
        if (currentStreak === 0 && state.hwm >= 2 && state.lastBrokenDate !== today) {
          updated = { ...updated, lastBrokenDate: today, lastBrokenHwm: state.hwm };
        }
        if (JSON.stringify(updated) !== JSON.stringify(state)) saveStreakState(updated);
        setStreakState(updated);

        // Show streak toast once per app launch (only for non-milestone active streaks)
        const MILESTONES = [3, 7, 14, 30];
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
    }, [])
  );

  const { streak, moodIdentity, lastSession, daysSinceLastSession } = useMemo(() => {
    const last = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    return {
      streak: getStreak(sessions),
      moodIdentity: getMoodIdentity(sessions),
      lastSession: last,
      daysSinceLastSession: last
        ? Math.floor((Date.now() - last.timestamp) / (24 * 60 * 60 * 1000))
        : null,
    };
  }, [sessions]);

  const sessionCount = sessions.length;
  const accentColor = selectedMood ? MOODS[selectedMood].color : '#ffffff';
  const showStillFeeling = !isLoading && !selectedMood && lastSession != null && (Date.now() - lastSession.timestamp < 18 * 60 * 60 * 1000);
  const showWelcomeBack = !isLoading && !showStillFeeling && !selectedMood && lastSession !== null && daysSinceLastSession !== null && daysSinceLastSession >= 1;
  const { isPremium } = useSubscription();

  const dismissPanel = useCallback(() => {
    dismissPanelAnim(() => setSelectedMood(null));
  }, [dismissPanelAnim]);

  const handleMoodSelect = useCallback((mood: MoodKey) => {
    setSelectedMood(mood);
    setIntensity(5);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showPanel();
    setShowHint(false);
    setHomeHintSeen();
  }, [showPanel]);

  const handleDismissHint = useCallback(() => {
    setShowHint(false);
    setHomeHintSeen();
  }, []);

  const handleQuickSession = useCallback(() => {
    if (!moodIdentity) return;
    const workouts = getWorkoutsForMood(moodIdentity.dominantMood);
    if (workouts.length === 0) return;
    const pick = workouts[Math.floor(Math.random() * workouts.length)];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/workout',
      params: { mood: moodIdentity.dominantMood, workoutId: pick.id, intensity: '5' },
    });
  }, [moodIdentity]);

  const handleMilestoneDismiss = useCallback(async (milestoneDay: number) => {
    const updated = {
      ...streakState,
      seenMilestones: [...(streakState.seenMilestones ?? []), milestoneDay],
    };
    setStreakState(updated);
    await saveStreakState(updated);
  }, [streakState]);

  const handlePrescribe = useCallback(() => {
    if (!selectedMood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/prescription',
      params: { mood: selectedMood, intensity: String(intensity) },
    });
  }, [selectedMood, intensity]);

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
          {!isPremium && (
            <TouchableOpacity
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
              style={styles.proBadge}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro"
            >
              <Text style={styles.proBadgeText}>PRO</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.headline}>
          {moodIdentity && sessions.length >= 10
            ? `Still ${MOODS[moodIdentity.dominantMood].name.toLowerCase()}? Let\u2019s fix that.`
            : 'Alright. How bad is it?'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>Be honest. I&apos;m not here to judge. Much.</Text>

        {/* Prescription evolving — visible after 3 sessions with profile data */}
        {sessionCount >= 3 && !selectedMood && (userProfile.preferredTime || userProfile.primaryGoal) && (
          <View style={styles.prescriptionEvolvingRow} accessibilityLabel="Your prescription is personalizing">
            <Text style={styles.prescriptionEvolvingLabel}>PRESCRIPTION EVOLVING</Text>
            <Text style={styles.prescriptionEvolvingValue}>
              {[userProfile.preferredTime, userProfile.primaryGoal].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        {/* Mood identity — visible after 5 sessions */}
        {moodIdentity && !selectedMood && (
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
        )}

        {/* 7-day mood sparkline */}
        {sessions.length >= 2 && !selectedMood && (() => {
          const last7 = sessions.slice(-7);
          const maxVal = 10;
          const SPARK_H = 32;
          const first = last7[0].intensity;
          const last = last7[last7.length - 1].intensity;
          const diff = last - first;
          const trendLabel = Math.abs(diff) < 1
            ? '→ HOLDING STEADY'
            : diff < 0
            ? `↓ TRENDING BETTER`
            : `↑ TRENDING WORSE`;
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

        {/* Quick session — one-tap random workout for dominant mood */}
        {moodIdentity && !selectedMood && (
          <TouchableOpacity
            style={[styles.quickSessionCard, { borderLeftColor: MOODS[moodIdentity.dominantMood].color }]}
            onPress={handleQuickSession}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Quick session: random ${MOODS[moodIdentity.dominantMood].name} workout`}
          >
            <View style={styles.quickSessionLeft}>
              <Text style={styles.quickSessionLabel}>QUICK SESSION</Text>
              <Text style={[styles.quickSessionSub, { color: MOODS[moodIdentity.dominantMood].color }]}>
                Random {MOODS[moodIdentity.dominantMood].name.toUpperCase()} workout →
              </Text>
            </View>
            <Text style={styles.quickSessionArrow}>⚡</Text>
          </TouchableOpacity>
        )}

        {/* Weekly prescription entry — visible after 3+ sessions */}
        {sessionCount >= 3 && !selectedMood && (
          <TouchableOpacity
            style={styles.weeklyRxBanner}
            onPress={() => router.push('/weekly-prescription' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View your weekly prescription"
          >
            <View style={styles.weeklyRxLeft}>
              <Text style={styles.weeklyRxLabel}>WEEKLY RX</Text>
              <Text style={styles.weeklyRxSub}>Your 7-day plan is ready</Text>
            </View>
            <Text style={styles.weeklyRxArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── STREAK CONSEQUENCE — shown the day a streak breaks ── */}
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

        {/* ── STREAK MILESTONE — shown at 3/7/14/30 days, dismissible ── */}
        {streak > 0 && [3, 7, 14, 30].includes(streak) && !(streakState.seenMilestones ?? []).includes(streak) && (
          <View style={[styles.streakMilestoneBox, { borderLeftColor: '#D97706' }]}>
            <TouchableOpacity
              onPress={() => handleMilestoneDismiss(streak)}
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


        {/* Welcome back nudge — shows when user returns after 1+ day away */}
        {showWelcomeBack && lastSession && daysSinceLastSession !== null && (
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

        {/* Still feeling this? quick repeat banner */}
        {showStillFeeling && lastSession && (
          <TouchableOpacity
            style={[styles.stillFeelingBanner, { borderLeftColor: MOODS[lastSession.mood].color }]}
            onPress={() => router.push({ pathname: '/prescription', params: { mood: lastSession.mood, intensity: String(lastSession.intensity) } })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Last time you felt ${MOODS[lastSession.mood].name}. Tap to repeat.`}
          >
            <View style={styles.stillFeelingContent}>
              <Text style={styles.stillFeelingEyebrow}>QUICK REPEAT</Text>
              <Text style={styles.stillFeelingText}>
                Still {MOODS[lastSession.mood].name.toUpperCase()}? Start where you left off.
              </Text>
            </View>
            <Text style={styles.stillFeelingArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Onboarding hint — dismisses on first mood tap or ✕ */}
        {showHint && !selectedMood && (
          <View style={styles.hintBanner} accessibilityRole="none">
            <Text style={styles.hintText}>TAP A MOOD BELOW TO START →</Text>
            <TouchableOpacity
              onPress={handleDismissHint}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss hint"
            >
              <Text style={styles.hintDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/* Breathe tool link */}
        <TouchableOpacity
          onPress={() => router.push('/breathe' as any)}
          activeOpacity={0.6}
          style={styles.breatheLink}
          accessibilityRole="link"
          accessibilityLabel="Open box breathing tool"
        >
          <Text style={styles.breatheLinkText}>Need to breathe first? →</Text>
        </TouchableOpacity>

        {/* Safety net link */}
        <TouchableOpacity
          onPress={() => router.push('/crisis' as any)}
          activeOpacity={0.6}
          style={styles.safetyNetBtn}
          accessibilityRole="link"
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
      <Animated.View style={[styles.panel, { transform: [{ translateY: panelAnim }] }]}>
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
              <Text style={styles.drText}>{MOODS[selectedMood].drMoodRx}</Text>
            </View>

            {/* Intensity */}
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>INTENSITY</Text>
              <View style={styles.intensityValueRow}>
                <Text style={[styles.intensityValue, { color: accentColor }]}>{intensity}</Text>
                <Text style={styles.intensityMax}>/10</Text>
              </View>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={intensity}
              onValueChange={setIntensity}
              minimumTrackTintColor={accentColor}
              maximumTrackTintColor="#1a1a1a"
              thumbTintColor={accentColor}
              accessibilityLabel={`Mood intensity: ${intensity} out of 10`}
              accessibilityRole="adjustable"
            />

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

      <BottomNav />

      {/* Streak toast — once per app launch, non-milestone streaks only */}
      {showGreeting && (
        <Animated.View style={[styles.greetingToast, { opacity: greetingAnim, transform: [{ translateY: greetingAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          <View style={styles.greetingContent}>
            <Text style={styles.greetingLabel}>{greetingStreakLabel}</Text>
            <Text style={styles.greetingText}>{greetingStreakMsg}</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
              Animated.timing(greetingAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowGreeting(false));
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.greetingDismiss}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
  },
  checkInLabel: {
    ...t.label,
    color: '#c8c8c8',
    fontSize: 15,
    letterSpacing: 1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  sessionCount: {
    ...t.timestamp,
    color: '#c8c8c8',
    fontSize: 15,
    letterSpacing: 1,
  },
  settingsText: {
    ...t.timestamp,
    color: '#c8c8c8',
    fontSize: 15,
    letterSpacing: 1,
  },
  streakBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  streakBadgeText: {
    ...t.number,
    color: '#E8B84B',
  },
  proBadge: {
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    ...t.label,
    color: '#E8B84B',
    letterSpacing: 2,
    fontSize: 12,
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
    color: '#d4d4d4',
    marginTop: 12,
  },
  prescriptionEvolvingRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prescriptionEvolvingLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#059669',
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  prescriptionEvolvingValue: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  identityRow: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  identityLabel: {
    ...t.label,
    color: '#525252',
    letterSpacing: 3,
    fontSize: 11,
    marginBottom: 4,
  },
  identityValue: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.primary.bold,
    letterSpacing: 1,
  },
  identityCount: {
    ...t.label,
    color: '#525252',
    letterSpacing: 1,
    fontSize: 12,
    marginTop: 6,
  },
  streakBrokenBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#3a1010',
    backgroundColor: '#0d0808',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  streakBrokenLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#8b2020',
    letterSpacing: 4,
    marginBottom: 8,
  },
  streakBrokenCount: {
    fontFamily: fonts.mono.regular,
    fontSize: 56,
    color: '#5a1515',
    lineHeight: 60,
  },
  streakBrokenDays: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#5a1515',
    letterSpacing: 2,
    marginBottom: 10,
  },
  streakBrokenSub: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#7a2020',
    textAlign: 'center',
    lineHeight: 19,
  },
  streakMilestoneBox: {
    marginTop: 16,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingTop: 10,
    paddingBottom: 14,
    paddingRight: 16,
    backgroundColor: '#0d0d00',
  },
  milestoneDismiss: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  milestoneDismissText: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#444',
  },
  streakMilestoneNum: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#D97706',
    letterSpacing: 3,
    marginBottom: 6,
  },
  streakMilestoneMsg: {
    fontFamily: fonts.primary.regular,
    fontSize: 17,
    color: '#e8e8e8',
    lineHeight: 23,
  },
  streakBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    paddingLeft: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  streakBoxLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#D97706',
    letterSpacing: 3,
    marginBottom: 4,
  },
  streakBoxText: {
    ...t.number,
    color: '#c8c8c8',
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: '#D97706',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0f0f0f',
  },
  welcomeBackText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 1,
    flex: 1,
  },
  welcomeBackArrow: {
    ...t.label,
    color: '#D97706',
  },
  stillFeelingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#444',
    backgroundColor: '#0d0d0d',
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  stillFeelingContent: {
    flex: 1,
    gap: 3,
  },
  stillFeelingEyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#888',
    letterSpacing: 3,
  },
  stillFeelingText: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#c8c8c8',
  },
  stillFeelingArrow: {
    fontFamily: fonts.primary.bold,
    fontSize: 16,
    color: '#c8c8c8',
    marginLeft: 12,
  },
  weeklyRxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#444444',
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0d0d0d',
  },
  weeklyRxLeft: {
    gap: 2,
  },
  weeklyRxLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#888888',
    letterSpacing: 3,
  },
  weeklyRxSub: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
    color: '#c8c8c8',
  },
  weeklyRxArrow: {
    fontFamily: fonts.primary.bold,
    fontSize: 16,
    color: '#c8c8c8',
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
    color: '#555',
    letterSpacing: 2,
  },
  hintDismiss: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#333',
  },
  sparklineCard: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sparklineHeader: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#444',
    letterSpacing: 3,
    marginBottom: 8,
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
    marginTop: 8,
  },
  quickSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0a0a0a',
  },
  quickSessionLeft: {
    gap: 2,
  },
  quickSessionLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#888888',
    letterSpacing: 3,
  },
  quickSessionSub: {
    fontFamily: fonts.primary.regular,
    fontSize: 15,
  },
  quickSessionArrow: {
    fontSize: 18,
  },
  breatheLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 10,
  },
  breatheLinkText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#7EC8A0',
    letterSpacing: 1,
  },
  safetyNetBtn: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  safetyNetText: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#ffffff',
    opacity: 0.4,
    letterSpacing: 0.5,
  },
  moodList: {
    marginTop: 28,
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
    color: '#d4d4d4',
    marginTop: 2,
  },
  moodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moodCode: {
    ...t.code,
    color: '#c8c8c8',
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
    fontSize: 13,
  },
  drBox: {
    borderLeftWidth: 3,
    backgroundColor: '#0a0a0a',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  intensityLabel: {
    ...t.label,
    color: '#c8c8c8',
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
    color: '#c8c8c8',
    fontSize: 18,
    marginLeft: 3,
  },
  slider: {
    width: '100%',
    height: 36,
    marginTop: 2,
  },
  greetingToast: {
    position: 'absolute',
    bottom: 88,
    left: 24,
    right: 24,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  greetingContent: {
    flex: 1,
    gap: 4,
  },
  greetingLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#E8B84B',
    letterSpacing: 3,
  },
  greetingText: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#c8c8c8',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  greetingDismiss: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#555',
    marginLeft: 14,
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
    fontSize: 14,
  },
});
