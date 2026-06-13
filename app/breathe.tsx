import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fonts } from '../lib/typography';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { saveMindfulMinutesToHealth } from '@/lib/health';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PHASES = [
  { label: 'INHALE',  guide: 'breathe in',  duration: 4, toValue: 1 },
  { label: 'HOLD',    guide: 'hold',         duration: 4, toValue: 1 },
  { label: 'EXHALE',  guide: 'breathe out',  duration: 4, toValue: 0 },
  { label: 'HOLD',    guide: 'hold',         duration: 4, toValue: 0 },
] as const;

const PHASE_COLORS = ['#7EC8A0', '#A0C8A0', '#7EC8E0', '#A0A0C8'] as const;

export default function BreatheScreen() {
  const insets = useSafeAreaInsets();
  const [phaseIdx, setPhaseIdx] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(PHASES[0].duration);
  const [cycles, setCycles] = useState<number>(0);
  const [running, setRunning] = useState(false);

  const circleAnim = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);
  const secondsRef = useRef(PHASES[0].duration);
  const runningRef = useRef(false);
  const cyclesRef = useRef(0);

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const animatePhase = useCallback((idx: number) => {
    const phase = PHASES[idx];
    Animated.timing(circleAnim, {
      toValue: phase.toValue,
      duration: phase.duration * 1000,
      useNativeDriver: true,
    }).start();
  }, [circleAnim]);

  const stopBreathing = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (cyclesRef.current > 0) {
      // Opportunistic sync — log structured failures (not "user didn't
      // opt in") to the console so real platform issues are visible in
      // dev/logs without interrupting the user's breathing session UI.
      saveMindfulMinutesToHealth(cyclesRef.current).then((result) => {
        if (!result.ok && result.reason !== 'not_enabled') {
          console.warn('[MoodRx] HealthKit mindful sync did not persist', result.reason);
        }
      }).catch((e) => {
        console.warn('[MoodRx] HealthKit mindful sync threw', e);
      });
    }
    runningRef.current = false;
    setRunning(false);
    setPhaseIdx(0);
    setCountdown(PHASES[0].duration);
    circleAnim.stopAnimation();
    Animated.timing(circleAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [circleAnim]);

  useEffect(() => {
    cyclesRef.current = cycles;
  }, [cycles]);

  const startBreathing = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    phaseRef.current = 0;
    secondsRef.current = PHASES[0].duration;
    runningRef.current = true;
    setRunning(true);
    setPhaseIdx(0);
    setCountdown(PHASES[0].duration);
    setCycles(0);
    animatePhase(0);

    countdownRef.current = setInterval(() => {
      if (!runningRef.current) return;
      secondsRef.current -= 1;
      setCountdown(secondsRef.current);

      if (secondsRef.current <= 0) {
        const nextIdx = (phaseRef.current + 1) % 4;
        if (nextIdx === 0) setCycles(c => c + 1);
        phaseRef.current = nextIdx;
        secondsRef.current = PHASES[nextIdx].duration;
        setPhaseIdx(nextIdx);
        setCountdown(PHASES[nextIdx].duration);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animatePhase(nextIdx);
      }
    }, 1000);
  }, [animatePhase]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const scale = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const opacity = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.85],
  });

  const phase = PHASES[phaseIdx];
  const phaseColor = PHASE_COLORS[phaseIdx];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 56) }]}>
        <TouchableOpacity
          onPress={() => { stopBreathing(); router.back(); }}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>BOX BREATHING</Text>
        <View style={styles.cyclesBadge}>
          <Text style={styles.cyclesText}>{cycles > 0 ? `${cycles}x` : '  '}</Text>
        </View>
      </View>

      <View style={styles.circleContainer}>
        <Animated.View
          style={[styles.circleOuter, { transform: [{ scale }], opacity }]}
        >
          <View style={[styles.circleRing, { borderColor: phaseColor }]} />
        </Animated.View>

        <View style={styles.centerLabel} pointerEvents="none">
          {running ? (
            <>
              <Text style={[styles.phaseLabel, { color: phaseColor }]}>
                {phase.label}
              </Text>
              <Text style={styles.phaseCountdown}>{countdown}</Text>
              <Text style={styles.phaseGuide}>{phase.guide}</Text>
            </>
          ) : (
            <Text style={styles.readyLabel}>READY</Text>
          )}
        </View>
      </View>

      <Text style={styles.patternNote}>
        {running
          ? '4 · 4 · 4 · 4'
          : 'inhale · hold · exhale · hold'}
      </Text>

      <TouchableOpacity
        style={[styles.startBtn, running && styles.stopBtn]}
        onPress={running ? stopBreathing : startBreathing}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Stop breathing exercise' : 'Start breathing exercise'}
      >
        <Text style={styles.startBtnText}>{running ? 'STOP' : 'BEGIN'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {running
          ? 'Let the circle guide your breath.'
          : 'Four seconds each phase. Calms the nervous system in minutes.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  backBtn: {
    minWidth: 70,
  },
  backBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 1,
  },
  screenTitle: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 3,
    lineHeight: 18,
  },
  cyclesBadge: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  cyclesText: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 2,
  },
  circleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#0c1a12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  readyLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#cdcdcd',
    letterSpacing: 4,
  },
  phaseLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    letterSpacing: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  phaseCountdown: {
    fontFamily: fonts.mono.regular,
    fontSize: 60,
    color: '#ffffff',
    lineHeight: 64,
  },
  phaseGuide: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 2,
    marginTop: 10,
    lineHeight: 18,
  },
  patternNote: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 3,
    marginBottom: 32,
    lineHeight: 18,
  },
  startBtn: {
    borderWidth: 1,
    borderColor: '#7EC8A0',
    paddingVertical: 16,
    paddingHorizontal: 52,
    marginBottom: 20,
  },
  stopBtn: {
    borderColor: '#333',
  },
  startBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 4,
  },
  hint: {
    fontFamily: fonts.mono.regular,
    fontSize: 15,
    color: '#cdcdcd',
    letterSpacing: 1,
    marginBottom: 110,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
});
