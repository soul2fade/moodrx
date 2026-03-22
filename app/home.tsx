import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { getSessions, getStreak, Session } from '@/lib/storage';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import type { MoodKey } from '@/lib/storage';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '@/lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function HomeScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [intensity, setIntensity] = useState(5);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      getSessions().then(setSessions);
      setSelectedMood(null);
      setIntensity(5);
    }, [])
  );

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const sessionCount = sessions.length;
  const accentColor = selectedMood ? MOODS[selectedMood].color : '#ffffff';
  const { isPremium } = useSubscription();

  const handleMoodSelect = useCallback((mood: MoodKey) => {
    setSelectedMood(mood);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const onPressIn = useCallback(() => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [buttonScale]);
  const onPressOut = useCallback(() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(), [buttonScale]);

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
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <Text style={styles.checkInLabel}>CHECK-IN</Text>
          <View style={styles.topRight}>
            <TouchableOpacity
              onPress={() => router.push('/insights')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}, view insights`}
            >
              <Text style={styles.sessionCount}>
                {sessionCount} {sessionCount === 1 ? 'SESSION' : 'SESSIONS'}
              </Text>
            </TouchableOpacity>
            {streak >= 3 && (
              <View style={styles.streakBadge} accessibilityLabel={`${streak} day streak`}>
                <Text style={styles.streakBadgeText}>{streak}x</Text>
              </View>
            )}
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
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Text style={styles.settingsText}>SETTINGS</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.headline}>Alright. How bad is it?</Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>Be honest. I&apos;m not here to judge. Much.</Text>

        {streak >= 3 && (
          <View style={styles.streakBox}>
            <Text style={styles.streakBoxText}>You&apos;re on a roll. Don&apos;t blow it.</Text>
          </View>
        )}

        {/* Mood list */}
        <View style={styles.moodList} accessibilityRole="radiogroup" accessibilityLabel="Select your mood">
          {MOOD_ORDER.map((moodKey) => {
            const mood = MOODS[moodKey];
            const isSelected = selectedMood === moodKey;
            return (
              <TouchableOpacity
                key={moodKey}
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
                  size={28}
                  opacity={isSelected ? 1 : 0.65}
                  color={mood.color}
                />
                <View style={styles.moodTextBlock}>
                  <Text style={styles.moodName}>{mood.name}</Text>
                  <Text style={styles.moodDesc}>{mood.description}</Text>
                </View>
                <View style={styles.moodRight}>
                  <Text style={styles.moodCode}>{mood.code}</Text>
                  {isSelected && (
                    <Text style={[styles.moodChevron, { color: mood.color }]}>{'>'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* After mood selection */}
        {selectedMood && (
          <View style={styles.selectedSection}>
            {/* Dr. MoodRx says */}
            <View style={flattenStyle([styles.drBox, { borderLeftColor: accentColor }])}>
              <Text style={styles.drLabel}>DR. MOODRX SAYS</Text>
              <Text style={styles.drText}>{MOODS[selectedMood].drMoodRx}</Text>
            </View>

            {/* Intensity */}
            <Text style={styles.intensityLabel}>INTENSITY</Text>
            <View style={styles.sliderContainer}>
              <Text style={flattenStyle([styles.intensityValue, { color: accentColor }])}>
                {intensity}
              </Text>
              <Text style={styles.intensityMax}>/10</Text>
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
          </View>
        )}
      </ScrollView>
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
    paddingTop: 60,
    paddingBottom: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInLabel: {
    ...t.label,
    color: '#737373',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionCount: {
    ...t.timestamp,
    color: '#a3a3a3',
  },
  settingsText: {
    ...t.timestamp,
    color: '#a3a3a3',
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
    fontSize: 10,
  },
  headline: {
    ...t.headline,
    marginTop: 16,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#525252',
    marginTop: 12,
  },
  subtext: {
    ...t.bodyMuted,
    color: '#737373',
    marginTop: 12,
  },
  streakBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    paddingLeft: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  streakBoxText: {
    ...t.number,
    color: '#a3a3a3',
  },
  moodList: {
    marginTop: 28,
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    fontSize: 15,
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
    color: '#737373',
  },
  moodChevron: {
    fontSize: 14,
    fontFamily: fonts.primary.bold,
  },
  selectedSection: {
    marginTop: 24,
  },
  drBox: {
    borderLeftWidth: 3,
    backgroundColor: '#111111',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  drLabel: {
    ...t.label,
    color: '#737373',
  },
  drText: {
    ...t.soft,
    color: '#ffffff',
    marginTop: 8,
  },
  intensityLabel: {
    ...t.label,
    color: '#737373',
    marginTop: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  intensityValue: {
    ...t.dataValue,
    fontSize: 32,
  },
  intensityMax: {
    ...t.bodyMuted,
    color: '#737373',
    fontSize: 20,
    marginLeft: 4,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  prescribeButton: {
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    borderRadius: 0,
  },
  prescribeButtonText: {
    ...t.timer,
    fontSize: 12,
  },
});