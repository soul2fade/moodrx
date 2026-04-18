import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Encapsulates workout step timer logic:
 * countdown (3-2-1), running timer, and cleanup.
 *
 * Replaces the 5 state variables + 3 refs that were
 * scattered across workout.tsx.
 */
export function useWorkoutTimer(onTimerEnd: () => void) {
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerReady, setTimerReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const timerEndRef = useRef<number | null>(null);
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

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

  const startTimer = useCallback((seconds: number) => {
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
        setTimeout(() => onTimerEndRef.current(), 700);
      } else {
        setTimerSeconds(remaining);
      }
    }, 250);
  }, [clearTimer]);

  const selectTimer = useCallback((seconds: number) => {
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
  }, [clearTimer, clearCountdown, startTimer]);

  const stopTimer = useCallback(() => {
    clearCountdown();
    clearTimer();
  }, [clearCountdown, clearTimer]);

  const resetForNextStep = useCallback(() => {
    setTimerReady(false);
  }, []);

  const isTimerActive = timerSeconds !== null || countdown !== null;

  return {
    timerSeconds,
    timerReady,
    countdown,
    isTimerActive,
    clearTimer,
    clearCountdown,
    selectTimer,
    stopTimer,
    setTimerReady,
    resetForNextStep,
  };
}
