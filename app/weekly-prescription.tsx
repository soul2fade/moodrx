import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getSessions } from '@/lib/storage';
import { buildWeeklyPrescription, DayRx } from '@/lib/analytics';
import { MOODS } from '@/lib/moods';
import { fonts } from '@/lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WeeklyPrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<DayRx[]>([]);
  const [todayIdx, setTodayIdx] = useState(() => new Date().getDay());
  const [isLoading, setIsLoading] = useState(true);
  const { fadeAnim, slideAnim } = useScreenAnimation();

  useFocusEffect(
    useCallback(() => {
      setTodayIdx(new Date().getDay()); // refresh on every focus so day is current
      getSessions().then((sessions) => {
        setPlan(buildWeeklyPrescription(sessions));
        setIsLoading(false);
      });
    }, []),
  );

  const todayRx = plan.find((d) => d.dayIndex === todayIdx);

  const handleDayPress = (day: DayRx) => {
    router.push({
      pathname: '/prescription',
      params: { mood: day.mood, intensity: '5' },
    });
  };

  const handleFillToday = () => {
    if (!todayRx) return;
    router.push({
      pathname: '/prescription',
      params: { mood: todayRx.mood, intensity: '5' },
    });
  };

  return (
    <Animated.View
      style={[styles.root, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 60) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.headerSub}>ISSUED BY</Text>
          <Text style={styles.headerDoc}>DR. MOODRX</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>WEEKLY</Text>
        <Text style={styles.titleAccent}>PRESCRIPTION</Text>
      </View>

      <View style={styles.divider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <Text style={styles.loadingText}>BUILDING PLAN…</Text>
        ) : (
          plan.map((day) => {
            const isToday = day.dayIndex === todayIdx;
            const mood = MOODS[day.mood];
            return (
              <TouchableOpacity
                key={day.dayLabel}
                style={[styles.dayRow, isToday && styles.dayRowToday]}
                onPress={() => handleDayPress(day)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${day.dayLabel}: ${mood.name} — ${day.workoutName}, ${day.duration} min`}
              >
                {/* Left accent bar colored by mood */}
                <View style={[styles.dayAccent, { backgroundColor: mood.color }]} />

                <View style={styles.dayContent}>
                  <View style={styles.dayTopRow}>
                    <Text style={[styles.dayLabel, isToday && { color: mood.color }]}>
                      {day.dayLabel}
                      {isToday ? '  ·  TODAY' : ''}
                    </Text>
                    {day.isDataDriven && (
                      <Text style={[styles.dataBadge, { color: mood.color }]}>DATA</Text>
                    )}
                  </View>

                  <Text style={styles.workoutName}>{day.workoutName}</Text>

                  <View style={styles.metaRow}>
                    <Text
                      style={[styles.moodCode, { color: mood.color }]}
                    >
                      {mood.code}
                    </Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.moodName}>{mood.name.toUpperCase()}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.duration}>{day.duration} MIN</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.intensity}>{day.intensity.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.arrow}>→</Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* Data source note */}
        {!isLoading && (
          <Text style={styles.footnote}>
            {plan.some((d) => d.isDataDriven)
              ? 'PRESCRIPTION BASED ON YOUR SESSION HISTORY. UPDATES WEEKLY.'
              : 'LOG MORE SESSIONS TO PERSONALISE YOUR PRESCRIPTION.'}
          </Text>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CTA — fill today's prescription */}
      {todayRx && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.ctaButton, { borderColor: MOODS[todayRx.mood].color }]}
            onPress={handleFillToday}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start today's prescribed workout"
          >
            <Text style={styles.ctaLabel}>TODAY&apos;S PRESCRIPTION</Text>
            <Text style={[styles.ctaWorkout, { color: MOODS[todayRx.mood].color }]}>
              {todayRx.workoutName.toUpperCase()}
            </Text>
            <Text style={styles.ctaAction}>FILL NOW →</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  back: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 18,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerSub: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 17,
  },
  headerDoc: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 18,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
  },
  title: {
    fontFamily: fonts.primary.bold,
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 44,
  },
  titleAccent: {
    fontFamily: fonts.primary.bold,
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 44,
    opacity: 0.45,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  loadingText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 18,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingVertical: 16,
    paddingRight: 20,
  },
  dayRowToday: {
    backgroundColor: '#0f0f0f',
  },
  dayAccent: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 16,
    opacity: 0.5,
  },
  dayContent: {
    flex: 1,
  },
  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  dayLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 17,
  },
  dataBadge: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    letterSpacing: 2,
    opacity: 0.7,
    lineHeight: 17,
  },
  workoutName: {
    fontFamily: fonts.primary.bold,
    fontSize: 16,
    color: '#e8e8e8',
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  moodCode: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    letterSpacing: 1,
    lineHeight: 17,
    flexShrink: 0,
  },
  metaDot: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 17,
    flexShrink: 0,
  },
  moodName: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 1,
    flexShrink: 1,
  },
  duration: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 1,
    flexShrink: 1,
    minWidth: 40,
  },
  intensity: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 1,
    flexShrink: 1,
  },
  arrow: {
    fontFamily: fonts.primary.bold,
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 12,
    paddingTop: 18,
  },
  footnote: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 28,
    marginHorizontal: 24,
    lineHeight: 17,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#111111',
  },
  ctaButton: {
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  ctaLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 17,
  },
  ctaWorkout: {
    fontFamily: fonts.primary.bold,
    fontSize: 17,
    letterSpacing: -0.5,
  },
  ctaAction: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 2,
    lineHeight: 18,
  },
});
