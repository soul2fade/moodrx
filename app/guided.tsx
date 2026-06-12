import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { IntensityPicker } from '@/components/IntensityPicker';
import type { MoodKey } from '@/lib/storage';
import { getGuidedSessionDone, setGuidedSessionDone } from '@/lib/storage';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { getShortestWorkoutForMood } from '@/lib/workouts';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t } from '@/lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useSessions } from '@/contexts/SessionsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/colors';

export default function GuidedScreen() {
  const insets = useSafeAreaInsets();
  const { sessionCount } = useSessions();
  const [selectedMood, setSelectedMood] = useState<MoodKey>('anxious');
  const [intensity, setIntensity] = useState(5);
  const { fadeAnim, slideAnim } = useScreenAnimation();

  React.useEffect(() => {
    getGuidedSessionDone().then((done) => {
      if (done || sessionCount > 0) {
        router.replace('/home');
      }
    });
  }, [sessionCount]);

  const workout = getShortestWorkoutForMood(selectedMood);
  const accentColor = MOODS[selectedMood].color;

  const handleStart = useCallback(() => {
    if (!workout) return;
    router.push({
      pathname: '/workout',
      params: {
        mood: selectedMood,
        workoutId: workout.id,
        intensity: String(intensity),
        guided: '1',
      },
    });
  }, [workout, selectedMood, intensity]);

  const handleSkip = useCallback(async () => {
    await setGuidedSessionDone();
    router.replace('/home');
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 56) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepLabel}>FIRST SESSION</Text>
        <Text style={styles.headline}>Let&apos;s prove your brain wrong.</Text>
        <View style={styles.divider} />
        <Text style={styles.subtext}>
          Pick how you feel. We&apos;ll start with the shortest workout that matches — no excuses.
        </Text>
        <Text style={styles.hint}>Not sure? Anxious is a solid default.</Text>

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
                onPress={() => {
                  setSelectedMood(moodKey);
                }}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${mood.name}: ${mood.description}`}
              >
                <MoodIcon mood={moodKey} size={28} color={mood.color} opacity={isSelected ? 1 : 0.65} />
                <View style={styles.moodTextBlock}>
                  <Text style={styles.moodName}>{mood.name}</Text>
                  <Text style={[styles.moodDesc, { color: mood.color }]}>{mood.description}</Text>
                </View>
                <Text style={styles.moodCode}>{mood.code}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.intensitySection}>
          <View style={styles.intensityRow}>
            <Text style={styles.intensityLabel}>HOW BAD IS IT?</Text>
            <Text style={[styles.intensityValue, { color: accentColor }]}>{intensity}/10</Text>
          </View>
          <IntensityPicker
            value={intensity}
            onChange={setIntensity}
            accentColor={accentColor}
            accessibilityPrefix="Intensity"
          />
        </View>

        {workout && (
          <View style={[styles.workoutPreview, { borderLeftColor: accentColor }]}>
            <Text style={styles.workoutPreviewLabel}>YOUR FIRST PRESCRIPTION</Text>
            <Text style={styles.workoutPreviewName}>{workout.name}</Text>
            <Text style={styles.workoutPreviewMeta}>
              {workout.duration} min · {workout.intensity} · {workout.vibe}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.startButton, { borderColor: accentColor }]}
          onPress={handleStart}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Start ${workout?.name ?? 'workout'}`}
          disabled={!workout}
        >
          <Text style={[styles.startButtonText, { color: accentColor }]}>
            START {workout?.name.toUpperCase() ?? 'WORKOUT'} →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.6}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip guided session"
        >
          <Text style={styles.skipText}>SKIP FOR NOW</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 48 },
  stepLabel: { ...t.label, color: colors.accent, letterSpacing: 3 },
  headline: { ...t.headline, fontSize: 28, marginTop: 12 },
  divider: { width: 32, height: 1, backgroundColor: '#333333', marginVertical: 20 },
  subtext: { ...t.bodyMuted, fontSize: 15, lineHeight: 22 },
  hint: { ...t.softMuted, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  moodList: { marginTop: 24, gap: 2 },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    gap: 12,
  },
  moodRowSelected: {
    backgroundColor: '#111111',
  },
  moodTextBlock: { flex: 1 },
  moodName: { ...t.headlineSm, fontSize: 16 },
  moodDesc: { ...t.bodySm, fontSize: 12, lineHeight: 17, marginTop: 2 },
  moodCode: { ...t.label, fontSize: 12, lineHeight: 17, letterSpacing: 2 },
  intensitySection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 20 },
  intensityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intensityLabel: { ...t.label, color: '#d8d8d8' },
  intensityValue: { ...t.dataValue, fontSize: 24 },
  workoutPreview: {
    marginTop: 24,
    borderLeftWidth: 3,
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  workoutPreviewLabel: { ...t.label, color: '#d8d8d8', letterSpacing: 2 },
  workoutPreviewName: { ...t.headlineSm, fontSize: 17, marginTop: 6 },
  workoutPreviewMeta: { ...t.bodySm, color: '#cdcdcd', marginTop: 4 },
  startButton: {
    marginTop: 28,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: { ...t.button, letterSpacing: 2, fontSize: 12, lineHeight: 17 },
  skipButton: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  skipText: { ...t.label, color: '#cdcdcd', letterSpacing: 2, lineHeight: 17 },
});
