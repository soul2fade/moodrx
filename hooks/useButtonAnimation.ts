import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export function useButtonAnimation() {
  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }, [buttonScale]);

  const onPressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [buttonScale]);

  return { buttonScale, onPressIn, onPressOut };
}
