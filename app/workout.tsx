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
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { getWorkoutById, getWorkoutsForMood } from '@/lib/workouts';
import { getPersonalBest } from '@/lib/storage';
import { MoodIcon } from '@/components/MoodIcon';
import WorkoutCoach from '@/components/WorkoutCoach';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { getInsult } from '@/utils/insults';
import { fonts } from '../lib/typography';

function parseRestSeconds(text: string): number | null {
  const lower = text.toLowerCase();
  if (!lower.includes('rest') && !lower.includes('recover')) return null;
  const secMatch = lower.match(/(\d+)\s*sec/);
  const minMatch = lower.match(/(\d+)\s*min/);
  if (secMatch) return parseInt(secMatch[1], 10);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  return null;
}

const REST_COMPLETE_LINES = [
  "Rest complete. Back to work.",
  "Time's up. No more lounging.",
  "That's enough recovery. Move.",
  "Right. Off you go.",
  "Rest over. Your body is ready.",
];

const MOTIVATIONAL = [
  "Let's go.",
  "You showed up. Most didn't.",
  'Better than 90% of couches.',
  'Brain chemistry: changing.',
  'Halfway. Hard part was starting.',
  "Almost. Don't quit.",
  'Last one. Mean it.',
];

const AFFIRMATIONS = [
  'Your body is doing the work.',
  'One breath at a time.',
  'Notice how you feel right now.',
  'This moment matters.',
  'Stronger than you think.',
  "You're still here. That counts.",
  'Keep it simple. Just move.',
  'Your future self will thank you.',
  'The hard part was showing up.',
  'Progress, not perfection.',
  'Every step counts.',
  'You chose this. Own it.',
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
  require('../assets/audio/insults/insult_09.mp3'),
  require('../assets/audio/insults/insult_10.mp3'),
  require('../assets/audio/insults/insult_11.mp3'),
  require('../assets/audio/insults/insult_12.mp3'),
  require('../assets/audio/insults/insult_13.mp3'),
  require('../assets/audio/insults/insult_14.mp3'),
  require('../assets/audio/insults/insult_15.mp3'),
];

type Soundscape = 'rain' | 'forest' | 'focus' | null;

const SOUNDSCAPES: { key: Soundscape; label: string; src: any }[] = [
  { key: 'rain',   label: 'RAIN',    src: require('../assets/audio/rain.mp3') },
  { key: 'forest', label: 'FOREST',  src: require('../assets/audio/forest.mp3') },
  { key: 'focus',  label: 'FOCUS',   src: require('../assets/audio/whitenoise.mp3') },
];

const STEP_COMPLETE_SRC = require('../assets/audio/step_complete.wav');

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
  const [repCount, setRepCount] = useState(0);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [affirmIdx, setAffirmIdx] = useState(0);
  const [activeSoundscape, setActiveSoundscape] = useState<Soundscape>(null);
  const [audioSrc, setAudioSrc] = useState<any>(null);
  const [trashTalkOn, setTrashTalkOn] = useState(false);
  const [insultAudioSrc, setInsultAudioSrc] = useState<any>(null);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const [showTrashWarning, setShowTrashWarning] = useState(false);
  const warningAnim = useRef(new Animated.Value(0)).current;
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restProgressAnim = useRef(new Animated.Value(1)).current;
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insultIdxRef = useRef(0);
  const trashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNavigating = useRef(false);
  const repScaleAnim = useRef(new Animated.Value(1)).current;

  const { fadeAnim, slideAnim } = useScreenAnimation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const totalSteps = resolvedWorkout?.steps.length ?? 0;
  const midInsult = useRef(getInsult(mood, 'mid')).current;
  const midStep = Math.floor((totalSteps - 1) / 2);

  const player = useAudioPlayer(audioSrc);
  const insultPlayer = useAudioPlayer(insultAudioSrc);
  const stepCompletePlayer = useAudioPlayer(STEP_COMPLETE_SRC);

  useEffect(() => {
    if (audioSrc && activeSoundscape) {
      player.loop = true;
      player.play();
    }
  }, [audioSrc, activeSoundscape]);

  useEffect(() => {
    if (insultAudioSrc) {
      insultPlayer.seekTo(0);
      insultPlayer.play();
    }
  }, [insultAudioSrc]);

  useEffect(() => {
    return () => {
      try { player.remove(); } catch {}
      try { insultPlayer.remove(); } catch {}
      try { stepCompletePlayer.remove(); } catch {}
      if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!resolvedWorkout?.id) return;
    getPersonalBest(resolvedWorkout.id).then(pb => {
      if (pb) setPreviousBest(pb.reps);
    });
  }, [resolvedWorkout?.id]);

  useEffect(() => {
    if (restTimerRef.current) { clearInterval(restTimerRef.current); restTimerRef.current = null; }
    restProgressAnim.stopAnimation();
    if (!resolvedWorkout) return;
    const secs = parseRestSeconds(resolvedWorkout.steps[currentStep] ?? '');
    if (!secs) { setRestSecondsLeft(null); return; }
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    restProgressAnim.setValue(1);
    Animated.timing(restProgressAnim, { toValue: 0, duration: secs * 1000, useNativeDriver: false }).start();
    restTimerRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(restTimerRef.current!);
          restTimerRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const line = REST_COMPLETE_LINES[Math.floor(Math.random() * REST_COMPLETE_LINES.length)];
          Speech.speak(line, { language: 'en-GB', rate: 0.85, pitch: 0.78 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [currentStep]);

  useEffect(() => {
    if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    if (!trashTalkOn) {
      try { insultPlayer.pause(); } catch {}
      return;
    }
    const playNext = () => {
      const idx = insultIdxRef.current % INSULT_AUDIO.length;
      insultIdxRef.current += 1;
      setInsultAudioSrc(INSULT_AUDIO[idx]);
    };
    playNext();
    trashIntervalRef.current = setInterval(playNext, 40000);
    return () => {
      if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
    };
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

  const hwBackHandler = useCallback(() => {
    if (showQuitConfirm) { setShowQuitConfirm(false); return true; }
    if (currentStep > 0) { setCurrentStep((s) => s - 1); return true; }
    setShowQuitConfirm(true);
    return true;
  }, [showQuitConfirm, currentStep]);
  useHardwareBack(hwBackHandler);

  const onPressIn = useCallback(() => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [buttonScale]);
  const onPressOut = useCallback(() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(), [buttonScale]);

  const stopAll = () => {
    try { player.remove(); } catch {}
    try { insultPlayer.pause(); } catch {}
    if (trashIntervalRef.current) clearInterval(trashIntervalRef.current);
  };

  const handleNext = () => {
    if (!resolvedWorkout || isNavigating.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < totalSteps - 1) {
      try { stepCompletePlayer.seekTo(0); stepCompletePlayer.play(); } catch {}
      setCurrentStep((s) => s + 1);
    } else {
      isNavigating.current = true;
      stopAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/post-workout', params: { mood, workoutId, intensity, reps: String(repCount) } });
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

  const dismissTrashWarning = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    Animated.timing(warningAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowTrashWarning(false);
    });
  };

  const handleTrashTalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!trashTalkOn) {
      setShowTrashWarning(true);
      warningAnim.setValue(0);
      Animated.timing(warningAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      warningTimerRef.current = setTimeout(dismissTrashWarning, 2500);
    }
    setTrashTalkOn((on) => !on);
  };

  const handleRepTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRepCount((c) => c + 1);
    Animated.sequence([
      Animated.spring(repScaleAnim, { toValue: 1.15, useNativeDriver: true, speed: 80, bounciness: 8 }),
      Animated.spring(repScaleAnim, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 4 }),
    ]).start();
  };

  const handleAffirmation = () => {
    Haptics.selectionAsync();
    setAffirmIdx((i) => (i + 1) % AFFIRMATIONS.length);
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
    Haptics.selectionAsync();
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

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View style={{ height: 2, width: progressWidth, backgroundColor: accentColor }} />
      </View>

      {/* Top row */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => setShowQuitConfirm(true)} activeOpacity={0.7} style={styles.quitButton} accessibilityRole="button" accessibilityLabel="Quit workout">
          <Text style={styles.quitText}>X QUIT</Text>
        </TouchableOpacity>
        <Text style={styles.stepCounter}>{currentStep + 1} / {totalSteps}</Text>
      </View>

      {/* Quit confirmation */}
      {showQuitConfirm && (
        <View style={styles.quitConfirm} accessibilityRole="alert">
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
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Icon + title */}
        <View style={styles.iconCenter}>
          <MoodIcon mood={mood} size={36} color={accentColor} />
        </View>
        <Text style={styles.workoutName}>{resolvedWorkout.name}</Text>
        <Text style={styles.stepLabel}>STEP {currentStep + 1} OF {totalSteps}</Text>

        {/* Workout Coach */}
        <WorkoutCoach
          mood={mood}
          step={Math.min(3, Math.floor((currentStep / Math.max(totalSteps, 1)) * 4))}
          phraseKey={currentStep}
          figureSize={140}
          accentColor={accentColor}
        />

        {/* Step text box / Rest timer */}
        {restSecondsLeft !== null ? (
          <View style={styles.restBox}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={[styles.restCountdown, { color: accentColor }]}>
              {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, '0')}
            </Text>
            <View style={styles.restProgressBg}>
              <Animated.View style={[styles.restProgressFill, {
                width: restProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: restSecondsLeft === 0 ? '#525252' : accentColor,
              }]} />
            </View>
            <Text style={styles.restSubtext}>
              {restSecondsLeft === 0 ? 'get ready.' : 'breathe.'}
            </Text>
          </View>
        ) : (
          <View style={styles.stepBox}>
            <Text style={styles.stepText} accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}: ${resolvedWorkout.steps[currentStep]}`}>
              {resolvedWorkout.steps[currentStep]}
            </Text>
          </View>
        )}

        {/* Motivational */}
        {restSecondsLeft === null && <Text style={styles.motivational}>{motivationalMsg}</Text>}

        {/* Mid-workout insult — only when trash talk is off to avoid overlap */}
        {currentStep === midStep && midInsult !== '' && !trashTalkOn && (
          <Text style={styles.insultLine}>{midInsult}</Text>
        )}

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
                    isDone && { color: '#444' },
                    isActive && { color: accentColor },
                  ]}
                  numberOfLines={1}
                >
                  {step.length > 42 ? step.slice(0, 42) + '…' : step}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── REP COUNTER ── */}
        <View style={styles.repSection}>
          <View style={styles.repHeaderRow}>
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>REP COUNTER</Text>
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
                <Text style={[styles.repNum, { color: previousBest !== null && repCount > previousBest ? accentColor : accentColor }]}>{repCount}</Text>
                <Text style={styles.repLabel}>TAP</Text>
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
                  <Text style={[styles.soundBtnText, isOn && { color: accentColor }]}>{s.label}</Text>
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
              <Text style={[styles.soundBtnText, trashTalkOn && { color: '#E11D48' }]}>TRASH</Text>
            </TouchableOpacity>
            {(activeSoundscape || trashTalkOn) && (
              <TouchableOpacity onPress={() => { handleSoundscape(null); if (trashTalkOn) handleTrashTalk(); }} activeOpacity={0.7} style={styles.soundOffBtn}>
                <Text style={styles.soundOffText}>OFF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── AFFIRMATION ON TAP ── */}
        <TouchableOpacity onPress={handleAffirmation} activeOpacity={0.6} style={styles.affirmation} accessibilityRole="button" accessibilityLabel="Tap for a new affirmation">
          <Text style={styles.affirmText}>{AFFIRMATIONS[affirmIdx]}</Text>
          <Text style={styles.affirmHint}>tap for another</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Trash talk warning overlay */}
      {showTrashWarning && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={dismissTrashWarning}
          style={styles.warningOverlay}
          accessibilityRole="button"
          accessibilityLabel="Dismiss warning"
        >
          <Animated.View style={[styles.warningCard, { opacity: warningAnim, transform: [{ scale: warningAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <Text style={styles.warningTitle}>HEADS UP</Text>
            <Text style={styles.warningBody}>You're about to be roasted. It's all in good fun.</Text>
            <Text style={styles.warningHint}>tap anywhere to dismiss</Text>
          </Animated.View>
        </TouchableOpacity>
      )}

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
  errorText: { ...t.label, color: '#c8c8c8', textAlign: 'center', marginTop: 80 },
  progressBarBg: { width: '100%', height: 2, backgroundColor: '#1a1a1a' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 12 },
  quitButton: { paddingVertical: 4 },
  quitText: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
  stepCounter: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
  quitConfirm: { marginHorizontal: 24, borderWidth: 1, borderColor: '#E11D48', padding: 16, marginBottom: 8 },
  quitConfirmText: { ...t.body, fontSize: 14 },
  quitConfirmButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  keepGoingBtn: { paddingVertical: 8 },
  keepGoingText: { ...t.label, color: '#c8c8c8' },
  quitConfirmBtn: { borderWidth: 1, borderColor: '#E11D48', paddingHorizontal: 16, paddingVertical: 8 },
  quitConfirmBtnText: { ...t.label, color: '#E11D48', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  iconCenter: { alignItems: 'center', marginBottom: 12 },
  workoutName: { ...t.headlineMd, textAlign: 'center' },
  stepLabel: { ...t.step, textAlign: 'center', marginTop: 8 },
  stepBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a1a', paddingVertical: 24, paddingHorizontal: 16, marginTop: 16, minHeight: 80, justifyContent: 'center' },
  stepText: { ...t.body, textAlign: 'center', lineHeight: 24 },
  motivational: { ...t.soft, textAlign: 'center', marginTop: 24 },

  restBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a1a', paddingVertical: 32, paddingHorizontal: 16, marginTop: 16, alignItems: 'center' },
  restLabel: { ...t.label, color: '#888', letterSpacing: 4, fontSize: 10, marginBottom: 12 },
  restCountdown: { fontSize: 64, fontFamily: fonts.mono.regular, lineHeight: 72 },
  restProgressBg: { width: '100%', height: 2, backgroundColor: '#1a1a1a', marginTop: 20 },
  restProgressFill: { height: 2 },
  restSubtext: { ...t.label, color: '#555', letterSpacing: 2, fontSize: 9, marginTop: 12 },

  insultLine: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#525252',
    marginTop: 16,
    lineHeight: 18,
  },
  miniMap: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 16, gap: 10 },
  miniMapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniMapDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#888' },
  miniMapText: { ...t.label, color: '#e8e8e8', fontSize: 11, flex: 1, letterSpacing: 0.3 },

  repSection: { marginTop: 28 },
  sectionLabel: { ...t.label, color: '#888', letterSpacing: 2, fontSize: 10, marginBottom: 14 },
  repHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pbBadge: { fontFamily: fonts.mono.regular, fontSize: 10, color: '#555', letterSpacing: 2 },
  pbAlert: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 3, textAlign: 'center', marginTop: 10 },
  repRow: { flexDirection: 'column', alignItems: 'center', gap: 12 },
  repCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  repNum: { fontSize: 32, fontWeight: '600', lineHeight: 36 },
  repLabel: { ...t.label, color: '#888', fontSize: 9, letterSpacing: 2, marginTop: 2 },
  repReset: { paddingVertical: 8, paddingHorizontal: 16 },
  repResetText: { ...t.label, color: '#c8c8c8', letterSpacing: 2, fontSize: 10 },

  soundSection: { marginTop: 28 },
  soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  soundBtn: { borderWidth: 1, borderColor: '#444', paddingVertical: 8, paddingHorizontal: 14 },
  soundBtnText: { ...t.label, color: '#c8c8c8', fontSize: 10, letterSpacing: 2 },
  soundOffBtn: { borderWidth: 1, borderColor: '#444', paddingVertical: 8, paddingHorizontal: 14 },
  soundOffText: { ...t.label, color: '#c8c8c8', fontSize: 10, letterSpacing: 2 },

  affirmation: { marginTop: 28, alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  affirmText: { ...t.body, textAlign: 'center', color: '#c8c8c8', fontSize: 13, lineHeight: 20 },
  affirmHint: { ...t.label, color: '#888', fontSize: 9, letterSpacing: 2, marginTop: 8 },

  warningOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, zIndex: 50 },
  warningCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', padding: 24, width: '100%' },
  warningTitle: { ...t.label, color: '#E11D48', letterSpacing: 3, fontSize: 10, marginBottom: 10 },
  warningBody: { fontFamily: fonts.mono.regular, fontSize: 13, color: '#c8c8c8', lineHeight: 20 },
  warningHint: { ...t.label, color: '#333', fontSize: 9, letterSpacing: 2, marginTop: 14 },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  backBtn: { borderWidth: 1, borderColor: '#1a1a1a', paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { ...t.timer, color: '#c8c8c8' },
  nextBtn: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 24 },
  nextBtnText: { ...t.timer },
});
