import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * Screen-entry animation: fade + slide-up from 16px, 220ms, on mount.
 *
 * Respects the OS Reduce Motion setting — when on, the values snap to
 * their final state immediately instead of animating, so users with
 * vestibular disorders / migraine sensitivity / motion sensitivity
 * don't get a slide on every screen change.
 *
 * Returns Animated.Value refs that callers wire into their root
 * <Animated.View> style.
 */
export function useScreenAnimation() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Animated.Value refs from useRef are stable; reduceMotion is the meaningful trigger.
  }, [reduceMotion]);

  return { fadeAnim, slideAnim };
}
