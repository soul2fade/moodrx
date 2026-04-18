import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Reusable slide-up bottom panel animation.
 * Replaces the duplicated panel/backdrop animation boilerplate
 * in home.tsx and insights.tsx.
 */
export function useBottomPanel(panelHeight: number) {
  const panelAnim = useRef(new Animated.Value(panelHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback(() => {
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [panelAnim, backdropAnim]);

  const dismiss = useCallback((onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(panelAnim, { toValue: panelHeight, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onComplete);
  }, [panelAnim, backdropAnim, panelHeight]);

  return { panelAnim, backdropAnim, show, dismiss };
}
