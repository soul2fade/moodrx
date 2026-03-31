import React, { useCallback, useRef, useState } from 'react';
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
import { addSession, getNotifPromptShown } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutById } from '@/lib/workouts';
import { type as t, fonts } from '../lib/typography';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

function getScoreContext(score: number): string {
  if (score <= 3) return 'Rough. But you moved.';
  if (score <= 5) return 'Improvement.';
  if (score <= 7) return 'Getting there.';
  return "That's what I'm talking about.";
}

export default function PostWorkoutScreen() {
  const params = useLocalSearchParams<{ mood: string; workoutId: string; intensity: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const workoutId = params.workoutId || '';
  const intensity = parseInt(params.intensity || '5', 10);

  const [postScore, setPostScore] = useState(5);
  const [rating, setRating] = useState<'yes' | 'somewhat' | 'no' | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workout = getWorkoutById(workoutId);
  const moodData = MOODS[mood];
  const accentColor = moodData.color;

  const buttonScale = useRef(new Animated.Value(1)).current;
  const { fadeAnim, slideAnim } = useScreenAnimation();

  // Prevent Android back button from going back to workout mid-flow
  const backHandler = useCallback(() => {
    router.replace('/home');
    return true;
  }, []);
  useHardwareBack(backHandler);

  const onPressIn = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const handleLog = async () => {
    if (isSubmitting) return; // prevent double-tap
    setIsSubmitting(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addSession({
        id: Date.now().toString(),
        mood,
        intensity,
        postScore,
        workoutName: workout?.name ?? workoutId,
        workoutId: workoutId || undefined,
        duration: workout?.duration ?? 0,
        timestamp: Date.now(),
        rating: rating ?? undefined,
      });
      const promptShown = await getNotifPromptShown();
      if (!promptShown) {
        setShowNotifPrompt(true);
      } else {
        router.replace('/home');
      }
    } catch {
      setIsSubmitting(false);
      Alert.alert('Save failed', 'Your session could not be saved. Please try again.');
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>You absolute legend.</Text>
        <Text style={styles.subtext}>
          You showed up when your brain said don&apos;t. That takes guts.
        </Text>

        <View style={styles.sectionDivider} />

        <View style={styles.scoreSection}>
          <Text style={styles.howLabel}>HOW DO YOU FEEL NOW?</Text>

          <View style={styles.scoreDisplay}>
            <Text style={{ fontSize: 64, fontWeight: '700', color: accentColor }}>{postScore}</Text>
            <Text style={styles.scoreDenom}>/10</Text>
          </View>

          <Text style={styles.scoreContext}>{getScoreContext(postScore)}</Text>

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
            accessibilityLabel={`Post-workout feeling: ${postScore} out of 10`}
            accessibilityRole="adjustable"
          />

          {/* Before → After delta */}
          <View style={styles.deltaRow}>
            <View style={styles.deltaBlock}>
              <Text style={styles.deltaBlockLabel}>BEFORE</Text>
              <Text style={styles.deltaBlockValue}>{intensity}</Text>
            </View>
            <Text style={styles.deltaArrow}>→</Text>
            <View style={styles.deltaBlock}>
              <Text style={styles.deltaBlockLabel}>NOW</Text>
              <Text style={[styles.deltaBlockValue, { color: accentColor }]}>{postScore}</Text>
            </View>
            <View style={[styles.deltaBlock, styles.deltaSeparated]}>
              <Text style={styles.deltaBlockLabel}>CHANGE</Text>
              <Text style={[styles.deltaBlockChange, {
                color: (postScore - intensity) >= 0 ? '#059669' : '#c8c8c8',
              }]}>
                {(postScore - intensity) > 0 ? `+${postScore - intensity}` : `${postScore - intensity}`}
              </Text>
            </View>
          </View>
        </View>

        {workout && (
          <View style={styles.workoutInfo}>
            <Text style={styles.completedLabel}>COMPLETED</Text>
            <Text style={styles.workoutName}>{workout.name}</Text>
          </View>
        )}

        <View style={styles.ratingSection}>
          <Text style={styles.ratingPrompt}>DID THIS ACTUALLY HELP?</Text>
          <View style={styles.ratingButtons}>
            {(['yes', 'somewhat', 'no'] as const).map((r) => {
              const label = r === 'yes' ? 'YES' : r === 'somewhat' ? 'SOMEWHAT' : 'NOT REALLY';
              const isSelected = rating === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRating(r)}
                  activeOpacity={0.7}
                  style={[styles.ratingBtn, isSelected && { borderColor: accentColor }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.ratingBtnText, isSelected && { color: accentColor }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.logButton}
            onPress={handleLog}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log session"
            disabled={isSubmitting}
          >
            <Text style={styles.logButtonText}>{isSubmitting ? 'SAVING...' : rating ? 'DONE. LOG IT. →' : 'LOG IT →'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      <NotificationPrompt
        visible={showNotifPrompt}
        onClose={() => {
          setShowNotifPrompt(false);
          router.replace('/home');
        }}
      />
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
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  headline: {
    ...t.headline,
    fontSize: 30,
    textAlign: 'center',
  },
  subtext: {
    ...t.soft,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginTop: 32,
  },
  scoreSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  howLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    textAlign: 'center',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  scoreDenom: {
    ...t.dataValue,
    color: '#c8c8c8',
    fontSize: 24,
    fontFamily: fonts.primary.regular,
    marginLeft: 4,
  },
  scoreContext: {
    ...t.bodyMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
    marginVertical: 16,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginTop: 4,
    width: '100%',
  },
  deltaBlock: {
    flex: 1,
    alignItems: 'center',
  },
  deltaSeparated: {
    borderLeftWidth: 1,
    borderLeftColor: '#1a1a1a',
  },
  deltaBlockLabel: {
    ...t.label,
    color: '#525252',
    letterSpacing: 2,
    fontSize: 9,
    marginBottom: 4,
  },
  deltaBlockValue: {
    ...t.dataValue,
    fontSize: 28,
    color: '#c8c8c8',
  },
  deltaBlockChange: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.mono.regular,
  },
  deltaArrow: {
    ...t.label,
    color: '#333333',
    fontSize: 16,
    marginHorizontal: 4,
  },
  workoutInfo: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
    alignItems: 'center',
  },
  completedLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
  workoutName: {
    ...t.headlineSm,
    fontSize: 16,
    marginTop: 4,
  },
  ratingSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 24,
  },
  ratingPrompt: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ratingBtnText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 1,
    fontSize: 10,
  },
  logButton: {
    marginTop: 24,
    backgroundColor: '#059669',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
  },
  logButtonText: {
    ...t.button,
    letterSpacing: 4,
  },
});