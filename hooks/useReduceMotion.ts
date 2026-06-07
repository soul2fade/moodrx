import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook that returns whether the user has the OS-level Reduce Motion
 * accessibility setting enabled.
 *
 * Subscribes to AccessibilityInfo's reduceMotionChanged event so the
 * value stays live if the user flips the setting mid-session
 * (uncommon but free to support).
 *
 * Use to gate spring/fade entry animations for users with vestibular
 * disorders, migraine sensitivity, or general motion sensitivity:
 *
 *   const reduceMotion = useReduceMotion();
 *   useEffect(() => {
 *     if (reduceMotion) {
 *       fadeAnim.setValue(1); // snap to final state
 *       return;
 *     }
 *     Animated.timing(fadeAnim, { toValue: 1, duration: 220, ... }).start();
 *   }, [reduceMotion]);
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!cancelled) setReduceMotion(on);
      })
      .catch(() => {
        // Querying the setting failed — leave reduceMotion=false. The
        // worst case is that a user with the setting on temporarily
        // sees animations until the event listener catches up.
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
