import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutById, getWorkoutsForMood } from '@/lib/workouts';
import { getPersonalBest, getTrashTalkVolume, getWorkoutFocusMode, getWorkoutVoiceMode, setWorkoutFocusMode, setWorkoutVoiceMode } from '@/lib/storage';
import { MoodIcon } from '@/components/MoodIcon';
import WorkoutCoach from '@/components/WorkoutCoach';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';
import { useDrMoodRxLine } from '@/hooks/useDrMoodRxLine';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/colors';
import { stepHasReps } from '@/lib/workout-ui';
import {
  pickWorkoutGuideCue,
  pickWorkoutGuideTimerCue,
} from '@/lib/workout-voice';

/** Extract a duration in seconds from a workout step description.
 *  Sums any number-of-minutes + number-of-seconds tokens present
 *  ("1 min 30 sec" → 90s, "Rest 45 sec" → 45s, "Hold 2 min" → 120s).
 *  Returns null when no time tokens are present. Previously the parser
 *  matched min OR sec but returned only one, so combined "X min Y sec"
 *  strings silently lost the larger component. */
function parseStepSeconds(text: string): number | null {
  const lower = text.toLowerCase();
  let total = 0;
  let matched = false;
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) {
    total += parseInt(minMatch[1], 10) * 60;
    matched = true;
  }
  const secMatch = lower.match(/(\d+)\s*sec/);
  if (secMatch) {
    total += parseInt(secMatch[1], 10);
    matched = true;
  }
  return matched ? total : null;
}

function parseRestSeconds(text: string): number | null {
  const lower = text.toLowerCase();
  if (!lower.includes('rest') && !lower.includes('recover')) return null;
  return parseStepSeconds(text);
}

function parseActiveSeconds(text: string): number | null {
  const lower = text.toLowerCase();
  if (lower.includes('rest') || lower.includes('recover')) return null;
  return parseStepSeconds(text);
}

const MOTIVATIONAL = [
  "Let's go.",
  "You showed up. Most didn't.",
  'Better than 90% of couches.',
  'Brain chemistry: changing.',
  'Halfway. Hard part was starting.',
  "Almost. Don't quit.",
  'Last one. Mean it.',
];


const INSULT_AUDIO = [
  require('../assets/audio/insults/insult_01.mp3'),
  require('../assets/audio/insults/insult_02.mp3'),
  require('../assets/audio/insults/insult_03.mp3'),
  require('../assets/audio/insults/insult_04.mp3'),
  require('../assets/audio/insults/insult_05.mp3'),
  require('../assets/audio/insults/insult_06.mp3'),
  require('../assets/audio/insults/insult_07.mp3'),
  require('../assets/audio/insults/insult_08.mp3'),
];

type Soundscape = 'rain' | 'forest' | 'focus' | null;
type StepTimerKind = 'rest' | 'active';

const SOUNDSCAPES: { key: Soundscape; label: string; src: any }[] = [
  { key: 'rain',   label: 'RAIN',    src: require('../assets/audio/rain.mp3') },
  { key: 'forest', label: 'FOREST',  src: require('../assets/audio/forest.mp3') },
  { key: 'focus',  label: 'FOCUS',   src: require('../assets/audio/brownnoise.mp3') },
];


export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Coach video: big like before (up to 400), but never wider than the screen
  // so it doesn't overflow on narrow phones (24pt side padding each side).
  const coachSize = Math.min(screenWidth - 48, 400);
  const params = useLocalSearchParams<{ mood: string; workoutId: string; intensity: string; guided?: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const workoutId = params.workoutId ?? '';
  const intensity = params.intensity || '5';
  const isGuided = params.guided === '1';

  const workout = workoutId ? getWorkoutById(workoutId) : getWorkoutsForMood(mood)[0];
  const resolvedWorkout = workout ?? getWorkoutsForMood(mood)[0];

  const [currentStep, setCurrentStep] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [activeSoundscape, setActiveSoundscape] = useState<Soundscape>(null);
  const [audioSrc, setAudioSrc] = useState<any>(null);
  const [trashTalkOn, setTrashTalkOn] = useState(false);
  const [trashTalkVolume, setTrashTalkVolume] = useState(0.7);
  const [keepAwake, setKeepAwake] = useState(false);
  const [insultAudioSrc, setInsultAudioSrc] = useState<any>(null);
  const [transitionAudioSrc, setTransitionAudioSrc] = useState<any>(null);
  const [stepTimerKind, setStepTimerKind] = useState<StepTimerKind | null>(null);
  const [stepTimerTotal, setStepTimerTotal] = useState(0);
  const [stepTimerRemaining, setStepTimerRemaining] = useState(0);
  const [stepTimerRunning, setStepTimerRunning] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const restProgressAnim = useRef(new Animated.Value(1)).current;
  const activeProgressAnim = useRef(new Animated.Value(1)).current;
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRemainingRef = useRef(0);
  const insultIdxRef = useRef(0);
  const trashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNavigating = useRef(false);
  const repScaleAnim = useRef(new Animated.Value(1)).current;

  const { fadeAnim, slideAnim } = useScreenAnimation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const { buttonScale, onPressIn, onPressOut } = useButtonAnimation();

  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const totalSteps = resolvedWorkout?.steps.length ?? 0;
  const midInsult = useDrMoodRxLine(mood, 'mid');
  const midStep = Math.floor((totalSteps - 1) / 2);

  const player = useAudioPlayer(audioSrc);
  const insultPlayer = useAudioPlayer(insultAudioSrc);
  const transitionPlayer = useAudioPlayer(transitionAudioSrc);
  useEffect(() => {
    if (audioSrc && activeSoundscape) {
      player.loop = true;
      player.volume = 0.35;
      player.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expo-audio player is a stable ref; effect intentionally only re-runs on src/activeSoundscape changes.
  }, [audioSrc, activeSoundscape]);

  useEffect(() => {
    getTrashTalkVolume().then(setTrashTalkVolume).catch(() => {});
  }, []);

  useEffect(() => {
    getWorkoutFocusMode().then(setFocusMode).catch(() => {});
    getWorkoutVoiceMode().then(setVoiceMode).catch(() => {});
  }, []);

  const handleFocusToggle = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      void setWorkoutFocusMode(next);
      return next;
    });
  }, []);

  const handleVoiceToggle = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      void setWorkoutVoiceMode(next);
      if (next) {
        setFocusMode(true);
        void setWorkoutFocusMode(true);
      } else {
        try { transitionPlayer.pause(); } catch {}
        try { insultPlayer.pause(); } catch {}
      }
      return next;
    });
  }, [transitionPlayer, insultPlayer]);

  useEffect(() => {
    insultPlayer.volume = trashTalkVolume;
  }, [trashTalkVolume, insultPlayer]);

  useEffect(() => {
    // Guarded: a state change can set insultAudioSrc as the screen tears
    // down (the unmount effect remove()s these players), so play() can race
    // a torn-down player. try/catch keeps that from throwing.
    try {
      if (insultAudioSrc) {
        insultPlayer.volume = trashTalkVolume;
        insultPlayer.seekTo(0);
        insultPlayer.play();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- insultPlayer is a stable expo-audio ref; src/volume changes drive re-runs.
  }, [insultAudioSrc, trashTalkVolume]);

  useEffect(() => {
    try {
      if (transitionAudioSrc) {
        transitionPlayer.seekTo(0);
        transitionPlayer.play();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transitionPlayer is a stable expo-audio ref; src changes drive re-runs.
  }, [transitionAudioSrc]);

  useEffect(() => {
    return () => {
      try { player.remove(); } catch {}
      try { insultPlayer.remove(); } catch {}
      try { transitionPlayer.remove(); } catch {}
      if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      deactivateKeepAwake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only unmount cleanup; all three players are stable refs.
  }, []);

  useEffect(() => {
    if (!resolvedWorkout?.id) return;
    getPersonalBest(resolvedWorkout.id).then(pb => {
      if (pb) setPreviousBest(pb.reps);
    });
  }, [resolvedWorkout?.id]);

  const clearStepTimerInterval = useCallback(() => {
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  const stopStepTimerProgress = useCallback(() => {
    restProgressAnim.stopAnimation();
    activeProgressAnim.stopAnimation();
  }, [restProgressAnim, activeProgressAnim]);

  useEffect(() => {
    stepTimerRemainingRef.current = stepTimerRemaining;
  }, [stepTimerRemaining]);

  // Initialize timer for timed steps — does not auto-start
  useEffect(() => {
    setStepTimerRunning(false);
    clearStepTimerInterval();
    stopStepTimerProgress();
    if (!resolvedWorkout) {
      setStepTimerKind(null);
      return;
    }
    const text = resolvedWorkout.steps[currentStep] ?? '';
    const restSecs = parseRestSeconds(text);
    const activeSecs = parseActiveSeconds(text);
    restProgressAnim.setValue(1);
    activeProgressAnim.setValue(1);
    if (restSecs) {
      setStepTimerKind('rest');
      setStepTimerTotal(restSecs);
      setStepTimerRemaining(restSecs);
      stepTimerRemainingRef.current = restSecs;
    } else if (activeSecs) {
      setStepTimerKind('active');
      setStepTimerTotal(activeSecs);
      setStepTimerRemaining(activeSecs);
      stepTimerRemainingRef.current = activeSecs;
    } else {
      setStepTimerKind(null);
    }
  }, [currentStep, resolvedWorkout, clearStepTimerInterval, stopStepTimerProgress, restProgressAnim, activeProgressAnim]);

  useEffect(() => {
    if (!stepTimerRunning || stepTimerKind === null) {
      clearStepTimerInterval();
      return;
    }

    stepTimerRef.current = setInterval(() => {
      setStepTimerRemaining((prev) => {
        if (prev <= 1) {
          clearStepTimerInterval();
          setStepTimerRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTransitionAudioSrc(pickWorkoutGuideTimerCue(currentStep, stepTimerKind === 'rest'));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearStepTimerInterval;
  }, [stepTimerRunning, stepTimerKind, currentStep, clearStepTimerInterval]);

  useEffect(() => {
    if (!stepTimerRunning || stepTimerKind === null) return;
    const remaining = stepTimerRemainingRef.current;
    if (remaining <= 0 || stepTimerTotal <= 0) return;
    const anim = stepTimerKind === 'rest' ? restProgressAnim : activeProgressAnim;
    anim.stopAnimation();
    anim.setValue(remaining / stepTimerTotal);
    Animated.timing(anim, {
      toValue: 0,
      duration: remaining * 1000,
      useNativeDriver: false,
    }).start();
  }, [stepTimerRunning, stepTimerKind, stepTimerTotal, restProgressAnim, activeProgressAnim]);

  const handleTimerStart = useCallback(() => {
    if (stepTimerKind === null) return;
    if (stepTimerRemaining <= 0) {
      setStepTimerRemaining(stepTimerTotal);
      stepTimerRemainingRef.current = stepTimerTotal;
      const anim = stepTimerKind === 'rest' ? restProgressAnim : activeProgressAnim;
      anim.setValue(1);
    }
    setStepTimerRunning(true);
  }, [stepTimerKind, stepTimerRemaining, stepTimerTotal, restProgressAnim, activeProgressAnim]);

  const handleTimerStop = useCallback(() => {
    if (!stepTimerRunning) return;
    setStepTimerRunning(false);
    clearStepTimerInterval();
    stopStepTimerProgress();
  }, [stepTimerRunning, clearStepTimerInterval, stopStepTimerProgress]);

  const handleTimerReset = useCallback(() => {
    setStepTimerRunning(false);
    clearStepTimerInterval();
    stopStepTimerProgress();
    setStepTimerRemaining(stepTimerTotal);
    stepTimerRemainingRef.current = stepTimerTotal;
    restProgressAnim.setValue(1);
    activeProgressAnim.setValue(1);
  }, [stepTimerTotal, clearStepTimerInterval, stopStepTimerProgress, restProgressAnim, activeProgressAnim]);

  useEffect(() => {
    if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    if (!trashTalkOn) {
      try { insultPlayer.pause(); } catch {}
      return;
    }
    // Start at a random position so every session sounds different
    insultIdxRef.current = Math.floor(Math.random() * INSULT_AUDIO.length);
    const playNext = () => {
      const idx = insultIdxRef.current % INSULT_AUDIO.length;
      insultIdxRef.current += 1;
      setInsultAudioSrc(INSULT_AUDIO[idx]);
    };
    playNext();
    trashIntervalRef.current = setInterval(playNext, 55000);
    return () => {
      if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- insultPlayer is a stable expo-audio ref; trashTalkOn toggle is the meaningful trigger.
  }, [trashTalkOn]);

  useEffect(() => {
    if (totalSteps === 0) return;
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, totalSteps]);

  useEffect(() => {
    setRepCount(0);
  }, [currentStep]);

  useEffect(() => {
    if (!voiceMode || !resolvedWorkout) return;
    const stepText = resolvedWorkout.steps[currentStep] ?? '';
    const isRest = parseRestSeconds(stepText) !== null;
    setTransitionAudioSrc(pickWorkoutGuideCue(currentStep, isRest));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, currentStep]);

  const hwBackHandler = useCallback(() => {
    if (showQuitConfirm) { setShowQuitConfirm(false); return true; }
    if (currentStep > 0) { setCurrentStep((s) => s - 1); return true; }
    setShowQuitConfirm(true);
    return true;
  }, [showQuitConfirm, currentStep]);
  useHardwareBack(hwBackHandler);

  const stopAll = () => {
    // pause(), not remove(): handleNext navigates with router.push, which
    // keeps THIS screen mounted in the stack. Calling player.remove() here
    // would leave a torn-down native player that a later soundscape toggle
    // or re-render (effect that calls player.play()) could touch — an
    // expo-audio use-after-remove, which is a hard native crash that
    // bypasses the JS ErrorBoundary. The unmount effect owns remove().
    try { player.pause(); } catch {}
    try { insultPlayer.pause(); } catch {}
    try { transitionPlayer.pause(); } catch {}
    if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
  };

  const handleNext = () => {
    if (!resolvedWorkout || isNavigating.current) return;
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      isNavigating.current = true;
      stopAll();
      router.push({
        pathname: '/post-workout',
        params: { mood, workoutId, intensity, reps: String(repCount), ...(isGuided ? { guided: '1' } : {}) },
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) { setShowQuitConfirm(true); }
    else { setCurrentStep((s) => s - 1); }
  };

  const handleQuit = () => {
    stopAll();
    router.replace('/home');
  };

  const handleTrashTalk = () => {
    setTrashTalkOn((on) => !on);
  };

  const handleKeepAwake = async () => {
    if (keepAwake) {
      deactivateKeepAwake();
      setKeepAwake(false);
    } else {
      await activateKeepAwakeAsync();
      setKeepAwake(true);
    }
  };

  const handleRepTap = () => {
    setRepCount((c) => c + 1);
    Animated.sequence([
      Animated.spring(repScaleAnim, { toValue: 1.15, useNativeDriver: true, speed: 80, bounciness: 8 }),
      Animated.spring(repScaleAnim, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 4 }),
    ]).start();
  };

  const handleSoundscape = (key: Soundscape) => {
    if (key === null || activeSoundscape === key) {
      setActiveSoundscape(null);
      setAudioSrc(null);
      try { player.pause(); } catch {}
      return;
    }
    const sound = SOUNDSCAPES.find((s) => s.key === key);
    if (!sound) return;
    setActiveSoundscape(key);
    setAudioSrc(sound.src);
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
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const currentStepText = resolvedWorkout.steps[currentStep] ?? '';
  const showRepCounter = stepHasReps(currentStepText);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View style={{ height: 2, width: progressWidth, backgroundColor: accentColor }} />
      </View>

      {/* Top row */}
      <View style={[styles.topRow, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <TouchableOpacity onPress={() => setShowQuitConfirm(true)} activeOpacity={0.7} style={styles.quitButton} accessibilityRole="button" accessibilityLabel="Quit workout">
          <Text style={styles.quitText} maxFontSizeMultiplier={1.3}>X QUIT</Text>
        </TouchableOpacity>
        <View style={styles.topRowRight}>
          <TouchableOpacity
            onPress={handleVoiceToggle}
            activeOpacity={0.7}
            style={[styles.focusBtn, voiceMode && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
            accessibilityRole="switch"
            accessibilityState={{ checked: voiceMode }}
            accessibilityLabel={`Voice mode ${voiceMode ? 'on' : 'off'}. Audio-only with the workout guide voice.`}
          >
            <Text style={[styles.focusBtnText, voiceMode && { color: accentColor }]} maxFontSizeMultiplier={1.3}>VOICE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFocusToggle}
            activeOpacity={0.7}
            style={[styles.focusBtn, focusMode && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
            accessibilityRole="switch"
            accessibilityState={{ checked: focusMode }}
            accessibilityLabel={`Focus mode ${focusMode ? 'on' : 'off'}`}
          >
            <Text style={[styles.focusBtnText, focusMode && { color: accentColor }]} maxFontSizeMultiplier={1.3}>FOCUS</Text>
          </TouchableOpacity>
          <Text style={styles.stepCounter} maxFontSizeMultiplier={1.3}>{currentStep + 1} / {totalSteps}</Text>
        </View>
      </View>

      {/* Quit confirmation modal */}
      <Modal
        visible={showQuitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuitConfirm(false)}
      >
        <View style={styles.quitModalBackdrop}>
          <View style={styles.quitModalCard} accessibilityRole="alert">
            <Text style={styles.quitConfirmText}>Abandon this workout?</Text>
            <View style={styles.quitConfirmButtons}>
              <TouchableOpacity onPress={() => setShowQuitConfirm(false)} activeOpacity={0.7} style={styles.keepGoingBtn} accessibilityRole="button">
                <Text style={styles.keepGoingText}>Keep going</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleQuit} activeOpacity={0.7} style={styles.quitConfirmBtn} accessibilityRole="button">
                <Text style={styles.quitConfirmBtnText}>Quit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Icon + title */}
        <View style={styles.iconCenter}>
          <MoodIcon mood={mood} size={36} color={accentColor} />
        </View>
        <Text style={styles.workoutName}>{resolvedWorkout.name}</Text>
        <Text style={styles.stepLabel}>STEP {currentStep + 1} OF {totalSteps}</Text>

        {/* Workout Coach */}
        {!focusMode && (
        <WorkoutCoach
          mood={mood}
          step={Math.min(3, Math.floor((currentStep / Math.max(totalSteps, 1)) * 4))}
          phraseKey={currentStep}
          figureSize={coachSize}
          accentColor={accentColor}
        />
        )}

        {/* Step text box / Rest timer */}
        {stepTimerKind === 'rest' ? (
          <View style={styles.restBox}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={[styles.restCountdown, { color: stepTimerRemaining === 0 ? colors.textDimmer : accentColor }]} maxFontSizeMultiplier={1.3}>
              {Math.floor(stepTimerRemaining / 60)}:{String(stepTimerRemaining % 60).padStart(2, '0')}
            </Text>
            <View style={styles.restProgressBg}>
              <Animated.View style={[styles.restProgressFill, {
                width: restProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: stepTimerRemaining === 0 ? colors.textDimmer : accentColor,
              }]} />
            </View>
            <Text style={styles.restSubtext}>
              {stepTimerRemaining === 0 ? 'get ready.' : stepTimerRunning ? 'breathe.' : 'tap start when ready.'}
            </Text>
            <View style={styles.timerControlsRow}>
              {stepTimerRunning ? (
                <TouchableOpacity onPress={handleTimerStop} activeOpacity={0.7} style={[styles.timerControlBtn, { borderColor: accentColor }]} accessibilityRole="button" accessibilityLabel="Stop timer">
                  <Text style={[styles.timerControlBtnText, { color: accentColor }]}>STOP</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleTimerStart} activeOpacity={0.7} style={[styles.timerControlBtn, { borderColor: accentColor }]} accessibilityRole="button" accessibilityLabel="Start timer">
                  <Text style={[styles.timerControlBtnText, { color: accentColor }]}>START</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleTimerReset} activeOpacity={0.7} style={styles.timerControlBtn} accessibilityRole="button" accessibilityLabel="Reset timer">
                <Text style={styles.timerControlBtnText}>RESET</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.stepBox}>
            <Text style={styles.stepText} accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}: ${resolvedWorkout.steps[currentStep]}`}>
              {resolvedWorkout.steps[currentStep]}
            </Text>
            {stepTimerKind === 'active' && (
              <View style={styles.activeTimerBox}>
                <Text style={[styles.activeTimerCountdown, { color: stepTimerRemaining === 0 ? colors.textDimmer : accentColor }]} maxFontSizeMultiplier={1.3}>
                  {Math.floor(stepTimerRemaining / 60)}:{String(stepTimerRemaining % 60).padStart(2, '0')}
                </Text>
                <View style={styles.activeProgressBg}>
                  <Animated.View style={[styles.activeProgressFill, {
                    width: activeProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: stepTimerRemaining === 0 ? colors.textDimmer : accentColor,
                  }]} />
                </View>
                {stepTimerRemaining === 0 && (
                  <Text style={styles.activeTimerDone}>DONE — HIT NEXT</Text>
                )}
                {!stepTimerRunning && stepTimerRemaining > 0 && (
                  <Text style={styles.activeTimerHint}>tap start when ready.</Text>
                )}
                <View style={styles.timerControlsRow}>
                  {stepTimerRunning ? (
                    <TouchableOpacity onPress={handleTimerStop} activeOpacity={0.7} style={[styles.timerControlBtn, { borderColor: accentColor }]} accessibilityRole="button" accessibilityLabel="Stop timer">
                      <Text style={[styles.timerControlBtnText, { color: accentColor }]}>STOP</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleTimerStart} activeOpacity={0.7} style={[styles.timerControlBtn, { borderColor: accentColor }]} accessibilityRole="button" accessibilityLabel="Start timer">
                      <Text style={[styles.timerControlBtnText, { color: accentColor }]}>START</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleTimerReset} activeOpacity={0.7} style={styles.timerControlBtn} accessibilityRole="button" accessibilityLabel="Reset timer">
                    <Text style={styles.timerControlBtnText}>RESET</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Motivational */}
        {stepTimerKind !== 'rest' && <Text style={styles.motivational}>{motivationalMsg}</Text>}

        {/* Mid-workout insult — only when trash talk is off to avoid overlap */}
        {!focusMode && currentStep === midStep && midInsult !== '' && !trashTalkOn && (
          <Text style={styles.insultLine}>{midInsult}</Text>
        )}

        {!focusMode && (
        <>
        {/* ── STEP MINI-MAP ── */}
        <View style={styles.miniMap}>
          {resolvedWorkout.steps.map((step, idx) => {
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            return (
              <View key={idx} style={styles.miniMapRow}>
                <View style={[
                  styles.miniMapDot,
                  isDone && { backgroundColor: accentColor + '50' },
                  isActive && { backgroundColor: accentColor },
                ]} />
                <Text
                  style={[
                    styles.miniMapText,
                    isDone && { color: '#999' },
                    isActive && { color: accentColor },
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── REP COUNTER ── */}
        {showRepCounter && (
        <View style={styles.repSection}>
          <View style={styles.repHeaderRow}>
            <Text style={[styles.sectionLabel, { marginBottom: 0, fontSize: 16 }]}>REP COUNTER</Text>
            {previousBest !== null && (
              <Text style={styles.pbBadge}>PB  {previousBest}</Text>
            )}
          </View>
          <View style={styles.repRow}>
            <Animated.View style={{ transform: [{ scale: repScaleAnim }] }}>
              <TouchableOpacity
                onPress={handleRepTap}
                activeOpacity={0.75}
                style={[styles.repCircle, { borderColor: repCount > 0 && previousBest !== null && repCount > previousBest ? accentColor : accentColor }]}
                accessibilityRole="button"
                accessibilityLabel={`Rep count ${repCount}, tap to increment`}
              >
                <Text style={[styles.repNum, { color: previousBest !== null && repCount > previousBest ? accentColor : accentColor }]} maxFontSizeMultiplier={1.3}>{repCount}</Text>
                <Text style={styles.repLabel} maxFontSizeMultiplier={1.3}>TAP</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity onPress={() => setRepCount(0)} activeOpacity={0.6} style={styles.repReset}>
              <Text style={styles.repResetText}>RESET</Text>
            </TouchableOpacity>
          </View>
          {previousBest !== null && repCount > previousBest && (
            <Text style={[styles.pbAlert, { color: accentColor }]}>NEW BEST</Text>
          )}
        </View>
        )}

        {/* ── SOUNDSCAPE ── */}
        <View style={styles.soundSection}>
          <Text style={styles.sectionLabel}>SOUNDSCAPE</Text>
          <View style={styles.soundRow}>
            {SOUNDSCAPES.map((s) => {
              const isOn = activeSoundscape === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => handleSoundscape(s.key)}
                  activeOpacity={0.7}
                  style={[styles.soundBtn, isOn && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label} soundscape ${isOn ? 'on' : 'off'}`}
                >
                  <Text style={[styles.soundBtnText, isOn && { color: accentColor }]} numberOfLines={1}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={handleTrashTalk}
              activeOpacity={0.7}
              style={[styles.soundBtn, trashTalkOn && { borderColor: '#E11D48', backgroundColor: '#E11D4818' }]}
              accessibilityRole="button"
              accessibilityLabel={`Trash talk mode ${trashTalkOn ? 'on' : 'off'}`}
            >
              <Text style={[styles.soundBtnText, trashTalkOn && { color: '#E11D48' }]}>TRASH TALK</Text>
            </TouchableOpacity>
            {(activeSoundscape || trashTalkOn) && (
              <TouchableOpacity onPress={() => { handleSoundscape(null); if (trashTalkOn) handleTrashTalk(); }} activeOpacity={0.7} style={styles.soundOffBtn}>
                <Text style={styles.soundOffText}>OFF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── KEEP AWAKE ── */}
        <TouchableOpacity
          onPress={handleKeepAwake}
          activeOpacity={0.7}
          style={[styles.keepAwakeBtn, keepAwake && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
          accessibilityRole="button"
          accessibilityLabel={`Keep screen awake ${keepAwake ? 'on' : 'off'}`}
        >
          <Text style={[styles.keepAwakeBtnText, keepAwake && { color: accentColor }]}>
            {keepAwake ? 'SCREEN ON  ●' : 'KEEP SCREEN ON'}
          </Text>
        </TouchableOpacity>

        </>
        )}

      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={currentStep === 0 ? 'Quit workout' : 'Previous step'}>
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
            <Text style={[styles.nextBtnText, { color: accentColor }]}>
              {isLastStep ? 'DONE. LEGEND. →' : 'NEXT →'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  errorText: { ...t.label, color: '#ffffff', textAlign: 'center', marginTop: 80 },
  progressBarBg: { width: '100%', height: 2, backgroundColor: '#1a1a1a' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 12 },
  topRowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  focusBtn: { borderWidth: 1, borderColor: '#333333', paddingHorizontal: 10, paddingVertical: 6 },
  focusBtnText: { ...t.label, color: '#999999', letterSpacing: 1.5, fontSize: 12, lineHeight: 17 },
  quitButton: { paddingVertical: 4 },
  quitText: { ...t.label, color: '#ffffff', letterSpacing: 2, lineHeight: undefined },
  stepCounter: { ...t.label, color: '#ffffff', letterSpacing: 2, lineHeight: undefined },
  quitConfirm: { marginHorizontal: 24, borderWidth: 1, borderColor: '#E11D48', padding: 16, marginBottom: 8 },
  quitModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  quitModalCard: {
    borderWidth: 1,
    borderColor: '#E11D48',
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  quitConfirmText: { ...t.body, fontSize: 15 },
  quitConfirmButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  keepGoingBtn: { paddingVertical: 8 },
  keepGoingText: { ...t.label, color: '#ffffff' },
  quitConfirmBtn: { borderWidth: 1, borderColor: '#E11D48', paddingHorizontal: 16, paddingVertical: 8 },
  quitConfirmBtnText: { ...t.label, color: '#E11D48', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  iconCenter: { alignItems: 'center', marginBottom: 12 },
  workoutName: { ...t.headlineMd, textAlign: 'center', lineHeight: undefined },
  stepLabel: { ...t.step, textAlign: 'center', marginTop: 8, lineHeight: undefined },
  stepBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a1a', paddingVertical: 24, paddingHorizontal: 16, marginTop: 16, minHeight: 80, justifyContent: 'center' },
  stepText: { ...t.body, textAlign: 'center', lineHeight: undefined },
  motivational: { ...t.soft, textAlign: 'center', marginTop: 24 },

  restBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a1a', paddingVertical: 32, paddingHorizontal: 16, marginTop: 16, alignItems: 'center' },
  restLabel: { ...t.label, color: '#888', letterSpacing: 4, fontSize: 13, marginBottom: 12 },
  restCountdown: { fontSize: 68, fontFamily: fonts.mono.regular, lineHeight: 76 },
  restProgressBg: { width: '100%', height: 2, backgroundColor: '#1a1a1a', marginTop: 20 },
  restProgressFill: { height: 2 },
  restSubtext: { ...t.label, color: '#999', letterSpacing: 2, fontSize: 12, lineHeight: 17, marginTop: 12 },

  activeTimerBox: { marginTop: 20, alignItems: 'center', width: '100%' },
  activeTimerCountdown: { fontSize: 52, fontFamily: fonts.mono.regular, lineHeight: 58 },
  activeProgressBg: { width: '100%', height: 2, backgroundColor: '#1a1a1a', marginTop: 12 },
  activeProgressFill: { height: 2 },
  activeTimerDone: { ...t.label, color: '#ffffff', letterSpacing: 3, fontSize: 12, lineHeight: 17, marginTop: 10 },
  activeTimerHint: { ...t.label, color: '#999', letterSpacing: 2, fontSize: 12, lineHeight: 17, marginTop: 10 },

  timerControlsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  timerControlBtn: { borderWidth: 1, borderColor: '#444', paddingVertical: 10, paddingHorizontal: 20 },
  timerControlBtnText: { ...t.label, color: '#ffffff', letterSpacing: 2, fontSize: 13 },

  insultLine: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    marginTop: 16,
    lineHeight: 20,
  },
  miniMap: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 16, gap: 14 },
  miniMapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  miniMapDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#888', marginTop: 6 },
  miniMapText: { ...t.label, fontFamily: fonts.mono.bold, textTransform: 'none', color: '#e8e8e8', fontSize: 17, flex: 1, letterSpacing: 0.2, lineHeight: 26 },

  repSection: { marginTop: 28 },
  sectionLabel: { ...t.label, color: '#888', letterSpacing: 2, fontSize: 13, marginBottom: 14 },
  repHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pbBadge: { fontFamily: fonts.mono.regular, fontSize: 13, color: '#999', letterSpacing: 2 },
  pbAlert: { fontFamily: fonts.mono.regular, fontSize: 13, letterSpacing: 3, textAlign: 'center', marginTop: 10 },
  repRow: { flexDirection: 'column', alignItems: 'center', gap: 12 },
  repCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  repNum: { fontSize: 35, fontWeight: '600', lineHeight: 39 },
  repLabel: { ...t.label, color: '#888', fontSize: 12, lineHeight: 17, letterSpacing: 2, marginTop: 2 },
  repReset: { paddingVertical: 8, paddingHorizontal: 16 },
  repResetText: { ...t.label, color: '#ffffff', letterSpacing: 2, fontSize: 13 },

  soundSection: { marginTop: 28 },
  soundRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8 },
  soundBtn: { flex: 1, borderWidth: 1, borderColor: '#444', paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' },
  soundBtnText: { ...t.label, color: '#ffffff', fontSize: 12, lineHeight: 17, letterSpacing: 1 },
  soundOffBtn: { borderWidth: 1, borderColor: '#444', paddingVertical: 8, paddingHorizontal: 14 },
  soundOffText: { ...t.label, color: '#ffffff', fontSize: 13, letterSpacing: 2 },

  keepAwakeBtn: { marginTop: 16, borderWidth: 1, borderColor: '#333', paddingVertical: 10, alignItems: 'center' },
  keepAwakeBtnText: { ...t.label, color: '#999', fontSize: 13, letterSpacing: 2 },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  backBtn: { borderWidth: 1, borderColor: '#1a1a1a', paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { ...t.timer, color: '#ffffff' },
  nextBtn: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 24 },
  nextBtnText: { ...t.timer },
});
