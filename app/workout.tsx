import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutById, getWorkoutsForMood } from '@/lib/workouts';
import { MoodIcon } from '@/components/MoodIcon';
import WorkoutCoach from '@/components/WorkoutCoach';
import { ExerciseStickFigure } from '@/components/ExerciseStickFigure';
import { ExerciseVideo } from '@/components/ExerciseVideo';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const EXERCISE_VIDEOS: Record<string, string> = {
  'restless-1': 'https://github.com/soul2fade/moodrx/releases/download/v-assets-1/sprint-intervals.mp4',
  'restless-3': 'https://github.com/soul2fade/moodrx/releases/download/v-assets-1/sprint-intervals.mp4',
};

function parseStepDuration(stepText: string): number | null {
  const match = stepText.match(/(\d+)\s*sec(?:onds?)?/i);
  if (match) {
    const secs = parseInt(match[1], 10);
    if (secs > 0 && secs <= 300) return secs;
  }
  return null;
}

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
  const [timerReady, setTimerReady] = useState(false);   // unlocks NEXT once a timer is picked
  const [countdown, setCountdown] = useState<number | null>(null); // 3-2-1 phase
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const timerEndRef = useRef<number | null>(null);
  const isNavigating = useRef(false);
  const handleNextRef = useRef<() => void>(() => {});

  const { fadeAnim, slideAnim } = useScreenAnimation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const clearCountdown = useCallback(() => {
    countdownRef.current.forEach(clearTimeout);
    countdownRef.current = [];
    setCountdown(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      countdownRef.current.forEach(clearTimeout);
    };
  }, []);

  const hwBackHandler = useCallback(() => {
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
    return true;
  }, [showQuitConfirm, currentStep, clearTimer]);
  useHardwareBack(hwBackHandler);

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
        // Auto-advance to next step after a short breath
        setTimeout(() => handleNextRef.current(), 700);
      } else {
        setTimerSeconds(remaining);
      }
    }, 250);
  };

  const selectTimer = (seconds: number) => {
    clearTimer();
    clearCountdown();
    setTimerReady(true);
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(null);
      startTimer(seconds);
    }, 3000);
    countdownRef.current = [t1, t2, t3];
  };

  const stopTimer = () => {
    clearCountdown();
    clearTimer();
  };

  const onPressIn = useCallback(() => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [buttonScale]);
  const onPressOut = useCallback(() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(), [buttonScale]);

  const handleNext = () => {
    if (!resolvedWorkout) return;
    if (isNavigating.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    clearCountdown();
    if (currentStep < totalSteps - 1) {
      setTimerReady(false);
      setCurrentStep((s) => s + 1);
    } else {
      isNavigating.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/post-workout',
        params: { mood, workoutId, intensity },
      });
    }
  };

  // Keep ref current so the timer interval closure always calls the latest handleNext
  handleNextRef.current = handleNext;

  const handleBack = () => {
    if (currentStep === 0) {
      setShowQuitConfirm(true);
    } else {
      clearTimer();
      clearCountdown();
      setTimerReady(false);
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
        <Text style={styles.stepCounter}>{currentStep + 1} / {totalSteps}</Text>
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

        {/* Workout Coach */}
        <WorkoutCoach
          mood={mood}
          step={Math.min(3, Math.floor((currentStep / Math.max(totalSteps, 1)) * 4))}
          phraseKey={currentStep}
          figureSize={140}
        />

        {/* Step text box */}
        <View style={styles.stepBox}>
          <Text style={styles.stepText} accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}: ${resolvedWorkout.steps[currentStep]}`}>
            {resolvedWorkout.steps[currentStep]}
          </Text>
        </View>

        {/* Exercise animation — video clip if available, else animated stick figure */}
        <View style={styles.figureCenter}>
          {EXERCISE_VIDEOS[resolvedWorkout.id] ? (
            <ExerciseVideo
              source={EXERCISE_VIDEOS[resolvedWorkout.id]}
              accentColor={accentColor}
              size={200}
            />
          ) : (
            <ExerciseStickFigure
              stepText={resolvedWorkout.steps[currentStep]}
              color={accentColor}
              currentStep={currentStep}
              totalSteps={totalSteps}
              mood={mood}
              size={88}
            />
          )}
        </View>

        {/* Motivational */}
        <Text style={styles.motivational}>{motivationalMsg}</Text>

        {/* Timer section */}
        <View style={styles.timerSection}>
          {countdown !== null ? (
            /* 3 - 2 - 1 phase */
            <View style={styles.timerRunning}>
              <Text style={[styles.timerCount, { color: accentColor }]}>{countdown}</Text>
              <Text style={styles.timerRemainingLabel}>GET READY</Text>
            </View>
          ) : timerSeconds !== null ? (
            /* Timer running */
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
            /* Pick a duration — smart: show only the step's duration if it has one */
            <View style={styles.timerButtons}>
              <Text style={styles.timerPrompt}>SELECT TIME TO CONTINUE</Text>
              {(() => {
                const stepDuration = parseStepDuration(resolvedWorkout.steps[currentStep]);
                const durations = stepDuration ? [stepDuration] : [30, 60, 90];
                return durations.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    onPress={() => selectTimer(sec)}
                    activeOpacity={0.7}
                    style={[styles.timerButton, stepDuration ? styles.timerButtonSingle : null]}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${sec} second timer`}
                  >
                    <Text style={styles.timerButtonText}>{sec}S</Text>
                  </TouchableOpacity>
                ));
              })()}
              <TouchableOpacity
                onPress={() => setTimerReady(true)}
                activeOpacity={0.7}
                style={styles.wingItButton}
                accessibilityRole="button"
                accessibilityLabel="Skip timer, I already did it"
              >
                <Text style={styles.wingItText}>or just wing it →</Text>
              </TouchableOpacity>
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
          {(() => {
            const timerActive = timerSeconds !== null || countdown !== null;
            const canNext = timerReady && !timerActive;
            const canSkip = !timerReady && !timerActive;
            const handleSkip = () => {
              setTimerReady(true);
              handleNext();
            };
            if (timerActive) {
              return (
                <View style={flattenStyle([styles.nextBtn, { borderColor: '#2a2a2a' }])}>
                  <Text style={{ ...t.timer, color: '#3a3a3a' }}>NEXT →</Text>
                </View>
              );
            }
            return (
              <TouchableOpacity
                onPress={canSkip ? handleSkip : handleNext}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={0.7}
                style={flattenStyle([
                  styles.nextBtn,
                  { borderColor: canNext ? accentColor : '#555555' },
                ])}
                accessibilityRole="button"
                accessibilityLabel={canSkip ? 'Skip this step' : isLastStep ? 'Complete workout' : 'Next step'}
              >
                <Text style={{ ...t.timer, color: canNext ? accentColor : '#888888' }}>
                  {canSkip ? 'SKIP →' : isLastStep ? 'DONE. LEGEND. →' : 'NEXT →'}
                </Text>
              </TouchableOpacity>
            );
          })()}
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
    color: '#c8c8c8',
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
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  stepCounter: {
    ...t.label,
    color: '#c8c8c8',
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
    color: '#c8c8c8',
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
  figureCenter: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
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
    marginTop: 16,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  timerPrompt: {
    ...t.label,
    color: '#555',
    letterSpacing: 2,
    width: '100%',
    textAlign: 'center',
    marginBottom: 12,
  },
  timerButton: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#525252',
    paddingVertical: 8,
    alignItems: 'center',
  },
  timerButtonSingle: {
    flex: 0,
    minWidth: 100,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  timerButtonText: {
    ...t.timer,
    color: '#c8c8c8',
  },
  wingItButton: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 16,
  },
  wingItText: {
    ...t.label,
    color: '#3a3a3a',
    letterSpacing: 1,
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
    color: '#c8c8c8',
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
    color: '#c8c8c8',
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
    color: '#c8c8c8',
  },
  nextBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});