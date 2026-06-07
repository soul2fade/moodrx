import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import type { MoodKey } from '@/lib/storage';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import {
  MICRO_WORKOUT_DURATION_MIN,
  MICRO_WORKOUT_ID,
  MICRO_WORKOUT_NAME,
  MICRO_WORKOUT_STEPS,
} from '@/lib/micro-workout';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t } from '@/lib/typography';
import { useSessions } from '@/contexts/SessionsContext';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { createSessionId, formatSessionDelta } from '@/lib/session-utils';

export default function BadDayScreen() {
  const params = useLocalSearchParams<{ mood?: string; intensity?: string }>();
  const initialMood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : 'anxious';
  const initialIntensity = parseInt(params.intensity || '6', 10);

  const { addSession } = useSessions();
  const [mood, setMood] = useState<MoodKey>(initialMood);
  const [intensity, setIntensity] = useState(initialIntensity);
  const [postScore, setPostScore] = useState(Math.max(1, initialIntensity - 1));
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const accentColor = MOODS[mood].color;
  const onLastStep = step >= MICRO_WORKOUT_STEPS.length - 1;

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!onLastStep) {
      setStep((s) => s + 1);
    }
  };

  const handleLog = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addSession({
        id: createSessionId(),
        mood,
        intensity,
        postScore,
        workoutName: MICRO_WORKOUT_NAME,
        workoutId: MICRO_WORKOUT_ID,
        duration: MICRO_WORKOUT_DURATION_MIN,
        timestamp: Date.now(),
        lightDay: true,
        rating: 'somewhat',
      });
      router.replace('/home');
    } catch {
      setIsSubmitting(false);
      Alert.alert('Save failed', 'Could not log your check-in. Please try again.');
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backButton}>← HOME</Text>
        </TouchableOpacity>

        <Text style={styles.label}>BAD DAY MODE</Text>
        <Text style={styles.headline}>Two minutes. That&apos;s the whole bar.</Text>
        <Text style={styles.subtext}>
          No full workout. No guilt. Show up, breathe, take 20 steps, log it, keep your streak.
        </Text>

        <View style={styles.moodSection}>
          <Text style={styles.sectionLabel}>HOW DO YOU FEEL?</Text>
          <View style={styles.moodRow}>
            {MOOD_ORDER.map((moodKey) => {
              const selected = mood === moodKey;
              return (
                <TouchableOpacity
                  key={moodKey}
                  onPress={() => setMood(moodKey)}
                  style={selected
                    ? flattenStyle([styles.moodChip, { borderColor: MOODS[moodKey].color }])
                    : styles.moodChip}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <MoodIcon mood={moodKey} size={20} color={MOODS[moodKey].color} opacity={selected ? 1 : 0.5} />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.intensityRow}>
            <Text style={styles.intensityLabel}>INTENSITY {intensity}/10</Text>
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
          />
        </View>

        <View style={[styles.stepCard, { borderLeftColor: accentColor }]}>
          <Text style={styles.stepLabel}>STEP {step + 1} / {MICRO_WORKOUT_STEPS.length}</Text>
          <Text style={styles.stepText}>{MICRO_WORKOUT_STEPS[step]}</Text>
        </View>

        {!onLastStep ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { borderColor: accentColor }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryBtnText, { color: accentColor }]}>NEXT →</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.afterSection}>
              <Text style={styles.sectionLabel}>HOW DO YOU FEEL NOW?</Text>
              <Text style={[styles.postScore, { color: accentColor }]}>{postScore}/10</Text>
              <Text style={styles.deltaHint}>
                Shift: {formatSessionDelta(intensity, postScore)}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={postScore}
                onValueChange={setPostScore}
                minimumTrackTintColor={accentColor}
                maximumTrackTintColor="#1a1a1a"
                thumbTintColor={accentColor}
              />
            </View>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={handleLog}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              <Text style={styles.logBtnText}>{isSubmitting ? 'SAVING...' : 'LOG LIGHT DAY →'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 48 },
  backButton: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
  label: { ...t.label, color: '#E8B84B', letterSpacing: 3, marginTop: 24 },
  headline: { ...t.headline, fontSize: 26, marginTop: 8 },
  subtext: { ...t.bodyMuted, marginTop: 12, lineHeight: 22 },
  moodSection: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 20 },
  sectionLabel: { ...t.label, color: '#c8c8c8', letterSpacing: 2, marginBottom: 12 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 8,
  },
  intensityRow: { marginTop: 16 },
  intensityLabel: { ...t.label, color: '#c8c8c8' },
  slider: { width: '100%', height: 36, marginTop: 4 },
  stepCard: {
    marginTop: 24,
    borderLeftWidth: 3,
    backgroundColor: '#111111',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stepLabel: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
  stepText: { ...t.body, marginTop: 10, lineHeight: 24 },
  primaryBtn: {
    marginTop: 24,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { ...t.button, letterSpacing: 2 },
  afterSection: { marginTop: 28, alignItems: 'center' },
  postScore: { ...t.dataValue, fontSize: 40, marginTop: 8 },
  deltaHint: { ...t.bodySm, color: '#c8c8c8', marginTop: 4, marginBottom: 8 },
  logBtn: {
    marginTop: 24,
    backgroundColor: '#059669',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logBtnText: { ...t.button, letterSpacing: 3 },
});
