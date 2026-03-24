import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { getFirstLaunchDone } from '@/lib/storage';
import { type as t, fonts } from '@/lib/typography';

export default function Index() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in splash
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // After 1.6s, fade out and route
    const timer = setTimeout(async () => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(async () => {
        const done = await getFirstLaunchDone();
        if (done) {
          router.replace('/home');
        } else {
          router.replace('/onboarding');
        }
      });
    }, 1600);

    return () => clearTimeout(timer);
  }, [fadeAnim, fadeOut]);

  return (
    <Animated.View style={[styles.container, { opacity: Animated.multiply(fadeAnim, fadeOut) }]}>
      <Text style={styles.appName}>MoodRx</Text>
      <View style={styles.line} />
      <Text style={styles.tagline}>move for your mind</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...t.headline,
    fontSize: 40,
    letterSpacing: 2,
  },
  line: {
    width: 32,
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 16,
  },
  tagline: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#c8c8c8',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});