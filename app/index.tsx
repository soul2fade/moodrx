import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { getFirstLaunchDone, getSessions } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { fonts } from '@/lib/typography';
import type { MoodKey } from '@/lib/storage';

const WORDS = ['MOVE', 'FOR', 'YOUR', 'MIND'];

export default function Index() {
  const [pulseColor, setPulseColor] = useState('#ffffff');

  const rxScale   = useRef(new Animated.Value(1.18)).current;
  const rxOpacity = useRef(new Animated.Value(0)).current;
  const moodX     = useRef(new Animated.Value(-56)).current;
  const moodOpacity = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale  = useRef(new Animated.Value(0.2)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const wordAnims = useRef(WORDS.map(() => new Animated.Value(0))).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const run = async () => {
      try {
        const sessions = await getSessions();
        if (sessions.length > 0) {
          const lastMood = sessions[sessions.length - 1].mood as MoodKey;
          setPulseColor(MOODS[lastMood].color);
        }
      } catch {}

      // Phase 1 — Rx scales down + fades in (0–350ms)
      Animated.parallel([
        Animated.timing(rxOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(rxScale,   { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();

      // Phase 2 — Mood slides in from left (180ms)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(moodOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(moodX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 0 }),
        ]).start();
      }, 180);

      // Divider fades in after Mood lands
      setTimeout(() => {
        Animated.timing(lineOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }, 400);

      // Phase 3 — Heartbeat pulse ring expands (350ms)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 3.8, duration: 800, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0.45, duration: 120, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0,    duration: 680, useNativeDriver: true }),
          ]),
        ]).start();
      }, 350);

      // Phase 4 — Tagline words stagger in (520ms+)
      WORDS.forEach((_, i) => {
        setTimeout(() => {
          Animated.timing(wordAnims[i], { toValue: 1, duration: 160, useNativeDriver: true }).start();
        }, 520 + i * 100);
      });

      // Phase 5 — Fade out + navigate (1520ms)
      setTimeout(async () => {
        Animated.timing(screenOpacity, { toValue: 0, duration: 280, useNativeDriver: true })
          .start(async () => {
            const done = await getFirstLaunchDone();
            router.replace(done ? '/home' : '/onboarding');
          });
      }, 1520);
    };

    run();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* Heartbeat pulse ring — behind everything */}
      <Animated.View
        style={[
          styles.pulseRing,
          { borderColor: pulseColor, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
        ]}
      />

      {/* Logo row: "Mood" slides in + "Rx" scales down */}
      <View style={styles.logoRow}>
        <Animated.Text
          style={[styles.logoMood, { opacity: moodOpacity, transform: [{ translateX: moodX }] }]}
        >
          Mood
        </Animated.Text>
        <Animated.Text
          style={[styles.logoRx, { opacity: rxOpacity, transform: [{ scale: rxScale }] }]}
        >
          Rx
        </Animated.Text>
      </View>

      {/* Divider */}
      <Animated.View style={[styles.line, { opacity: lineOpacity }]} />

      {/* Tagline — word by word */}
      <View style={styles.taglineRow}>
        {WORDS.map((word, i) => (
          <Animated.Text key={word} style={[styles.taglineWord, { opacity: wordAnims[i] }]}>
            {word}{i < WORDS.length - 1 ? ' ' : ''}
          </Animated.Text>
        ))}
      </View>

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
  pulseRing: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoMood: {
    fontFamily: fonts.primary.light,
    fontSize: 46,
    color: '#ffffff',
    letterSpacing: 1,
  },
  logoRx: {
    fontFamily: fonts.primary.bold,
    fontSize: 46,
    color: '#ffffff',
    letterSpacing: 1,
  },
  line: {
    width: 32,
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 18,
  },
  taglineRow: {
    flexDirection: 'row',
  },
  taglineWord: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
});
