import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { getFirstLaunchDone, setFirstLaunchDone } from '@/lib/storage';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';

const STEPS = [
  {
    num: '01',
    title: 'Tell us how you feel',
    sub: 'Pick your mood. Rate the intensity.',
  },
  {
    num: '02',
    title: 'Get a prescription',
    sub: '3 workouts matched to your state, with the science behind each.',
  },
  {
    num: '03',
    title: 'Track the evidence',
    sub: 'Rate how you feel after. Watch the data prove your brain wrong.',
  },
];

export default function OnboardingScreen() {
  const { fadeAnim, slideAnim } = useScreenAnimation();
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getFirstLaunchDone().then((done) => {
      if (done) router.replace('/home');
    });
  }, []);

  const onPressIn = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const handleStart = async () => {
    await setFirstLaunchDone();
    router.replace('/home');
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>Your brain is lying to you.</Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>
          It says you can&apos;t move. Science says movement is the fix.
        </Text>

        <Text style={styles.body}>
          MoodRx matches workouts to how you actually feel — backed by
          neuroscience, delivered with zero fluff.
        </Text>

        <View style={styles.stepsContainer}>
          {STEPS.map((step) => (
            <View key={step.num} style={styles.stepRow}>
              <Text style={styles.stepNum}>{step.num}</Text>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.preCTALine} />

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleStart}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Get started with MoodRx"
          >
            <Text style={styles.buttonText}>LET&apos;S GO →</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.disclaimer}>
          MoodRx is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider with questions about a medical condition. If you are experiencing a mental health crisis, contact the 988 Suicide & Crisis Lifeline (call or text 988) or go to your nearest emergency room.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  headline: {
    ...t.headline,
    fontSize: 36,
    textAlign: 'center',
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#525252',
    alignSelf: 'center',
    marginVertical: 24,
  },
  subtext: {
    ...t.bodyMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  body: {
    ...t.softMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  stepsContainer: {
    marginTop: 40,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a',
    paddingLeft: 12,
  },
  stepNum: {
    ...t.number,
    color: '#E8B84B',
    paddingTop: 2,
    minWidth: 28,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    ...t.headlineSm,
    fontSize: 15,
  },
  stepSub: {
    ...t.bodySm,
    color: '#737373',
    marginTop: 3,
  },
  preCTALine: {
    height: 1,
    backgroundColor: '#1a1a1a',
    width: '100%',
    marginTop: 40,
    marginBottom: 0,
  },
  button: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
  },
  buttonText: {
    ...t.button,
    letterSpacing: 4,
  },
  disclaimer: {
    ...t.label,
    fontFamily: fonts.mono.regular,
    color: '#525252',
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 24,
    textTransform: 'none' as const,
  },
});