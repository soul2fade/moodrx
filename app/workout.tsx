import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  BackHandler,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutById, getWorkoutsForMood } from '@/lib/workouts';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '../lib/typography';

const MOTIVATIONAL = [
  "Let's go.",
  "You showed up. Most didn't.",
  'Better than 90% of couches.',
  'Brain chemistry: changing.',
  'Halfway. Hard part was starting.',
  'Almost. Don\'t quit.',
  'Last one. Mean it.',
];

export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ mood: string; workoutId: string; intensity: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const workoutId = params.workoutId ?? '';
  const intensity = params.intensity || '5';

  const workout = workoutId ? getWorkoutById(workoutId) : getWorkoutsForMood(mood)[0];
  const resolvedWorkout = workout ?? getWorkoutsForMood(mood)[0];
  const [currentStep, setCurrentStep] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndRef = useRef<number | null>(null);
  const isNavigating = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const totalSteps = resolvedWorkout?.steps.length ?? 0;

  useEffect(() => {
    if (totalSteps === 0) return;
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, totalSteps]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    timerEndRef.current = null;
    setTimerSeconds(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Android hardware back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showQuitConfirm) {
        setShowQuitConfirm(false);
        return true;
      }
      if (currentStep > 0) {
        clearTimer();
        setCurrentStep((s) => s - 1);
        return true;
      }
      setShowQuitConfirm(true);
      return true; // prevent default back
    });
    return () => backHandler.remove();
  }, [showQuitConfirm, currentStep, clearTimer]);

  const startTimer = (seconds: number) => {
    clearTimer();
    const endTime = Date.now() + seconds * 1000;
    timerEndRef.current = endTime;
    setTimerSeconds(seconds);
    intervalRef.current = setInterval(() => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        timerEndRef.current = null;
        setTimerSeconds(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setTimerSeconds(remaining);
      }
    }, 250); // Check 4x/sec for accurate display after backgrounding
  };

  const stopTimer = () => {
    clearTimer();
  };

  const onPressIn = useCallback(() => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [buttonScale]);
  const onPressOut = useCallback(() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(), [buttonScale]);

  const handleNext = () => {
    if (!resolvedWorkout) return;
    if (isNavigating.current) return; // prevent double-tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Done — prevent double navigation
      isNavigating.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/post-workout',
        params: { mood, workoutId, intensity },
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      setShowQuitConfirm(true);
    } else {
      clearTimer();
      setCurrentStep((s) => s - 1);
    }
  };

  const handleQuit = () => {
    clearTimer();
    router.replace('/home');
  };

  if (!resolvedWorkout) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Workout not found.</Text>
      </View>
    );
  }

  const isLastStep = currentStep === totalSteps - 1;
  const motivationalMsg = MOTIVATIONAL[Math.min(currentStep, MOTIVATIONAL.length - 1)];

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={{ height: 2, width: progressWidth, backgroundColor: accentColor }}
        />
      </View>

      {/* Top row */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => setShowQuitConfirm(true)}
          activeOpacity={0.7}
          style={styles.quitButton}
          accessibilityRole="button"
          accessibilityLabel="Quit workout"
        >
          <Text style={styles.quitText}>X QUIT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/home')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go home"
        >
          <Text style={styles.homeText}>HOME</Text>
        </TouchableOpacity>
      </View>

      {/* Quit confirmation */}
      {showQuitConfirm && (
        <View style={styles.quitConfirm} accessibilityRole="alert">
          <Text style={styles.quitConfirmText}>Abandon this workout?</Text>
          <View style={styles.quitConfirmButtons}>
            <TouchableOpacity
              onPress={() => setShowQuitConfirm(false)}
              activeOpacity={0.7}
              style={styles.keepGoingBtn}
              accessibilityRole="button"
              accessibilityLabel="Keep going"
            >
              <Text style={styles.keepGoingText}>Keep going</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleQuit}
              activeOpacity={0.7}
              style={styles.quitConfirmBtn}
              accessibilityRole="button"
              accessibilityLabel="Quit workout"
            >
              <Text style={styles.quitConfirmBtnText}>Quit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon + title */}
        <View style={styles.iconCenter}>
          <MoodIcon mood={mood} size={36} color={accentColor} />
        </View>
        <Text style={styles.workoutName}>{resolvedWorkout.name}</Text>
        <Text style={styles.stepLabel}>
          STEP {currentStep + 1} OF {totalSteps}
        </Text>

        {/* Step text box */}
        <View style={styles.stepBox}>
          <Text style={styles.stepText} accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}: ${resolvedWorkout.steps[currentStep]}`}>
            {resolvedWorkout.steps[currentStep]}
          </Text>
        </View>

        {/* Motivational */}
        <Text style={styles.motivational}>{motivationalMsg}</Text>

        {/* Timer section */}
        <View style={styles.timerSection}>
          {timerSeconds !== null ? (
            <View style={styles.timerRunning}>
              <Text style={[styles.timerCount, { color: accentColor }]}>{timerSeconds}</Text>
              <Text style={styles.timerRemainingLabel}>SECONDS REMAINING</Text>
              <TouchableOpacity
                onPress={stopTimer}
                activeOpacity={0.7}
                style={styles.stopButton}
                accessibilityRole="button"
                accessibilityLabel="Stop timer"
              >
                <Text style={styles.stopButtonText}>STOP</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.timerButtons}>
              {[30, 60, 90].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  onPress={() => startTimer(sec)}
                  activeOpacity={0.7}
                  style={styles.timerButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${sec} second timer`}
                >
                  <Text style={styles.timerButtonText}>{sec}S</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={currentStep === 0 ? 'Quit workout' : 'Previous step'}
        >
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            onPress={handleNext}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.7}
            style={flattenStyle([styles.nextBtn, { borderColor: accentColor }])}
            accessibilityRole="button"
            accessibilityLabel={isLastStep ? 'Complete workout' : 'Next step'}
          >
            <Text style={{ ...t.timer, color: accentColor }}>
              {isLastStep ? 'DONE. LEGEND. →' : 'NEXT →'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  errorText: {
    ...t.label,
    color: '#737373',
    textAlign: 'center',
    marginTop: 80,
  },
  progressBarBg: {
    width: '100%',
    height: 2,
    backgroundColor: '#1a1a1a',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 12,
  },
  quitButton: {
    paddingVertical: 4,
  },
  quitText: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
  },
  homeText: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
  },
  quitConfirm: {
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E11D48',
    padding: 16,
    marginBottom: 8,
  },
  quitConfirmText: {
    ...t.body,
    fontSize: 14,
  },
  quitConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  keepGoingBtn: {
    paddingVertical: 8,
  },
  keepGoingText: {
    ...t.label,
    color: '#737373',
  },
  quitConfirmBtn: {
    borderWidth: 1,
    borderColor: '#E11D48',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quitConfirmBtnText: {
    ...t.label,
    color: '#E11D48',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  iconCenter: {
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: {
    ...t.headlineMd,
    textAlign: 'center',
  },
  stepLabel: {
    ...t.step,
    textAlign: 'center',
    marginTop: 8,
  },
  stepBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 24,
    minHeight: 80,
    justifyContent: 'center',
  },
  stepText: {
    ...t.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  motivational: {
    ...t.soft,
    textAlign: 'center',
    marginTop: 24,
  },
  timerSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  timerButtons: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  timerButton: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#525252',
    paddingVertical: 8,
    alignItems: 'center',
  },
  timerButtonText: {
    ...t.timer,
    color: '#737373',
  },
  timerRunning: {
    alignItems: 'center',
    gap: 8,
  },
  timerCount: {
    fontSize: 48,
    fontFamily: fonts.mono.regular,
    fontWeight: '700',
  },
  timerRemainingLabel: {
    ...t.timestamp,
    color: '#737373',
    letterSpacing: 2,
  },
  stopButton: {
    borderWidth: 1,
    borderColor: '#525252',
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginTop: 8,
  },
  stopButtonText: {
    ...t.timer,
    color: '#737373',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    ...t.timer,
    color: '#737373',
  },
  nextBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});