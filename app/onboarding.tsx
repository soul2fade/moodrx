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
import { useSubscription } from '@/contexts/SubscriptionContext';

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

const TRIAL_FEATURES = [
  'All 18 science-backed workouts',
  'Supplement tracker with research',
  'Full progress history',
];

export default function OnboardingScreen() {
  const { fadeAnim, slideAnim } = useScreenAnimation();
  const trialScale = useRef(new Animated.Value(1)).current;
  const { startTrial, hasUsedTrial } = useSubscription();

  useEffect(() => {
    getFirstLaunchDone().then((done) => {
      if (done) router.replace('/home');
    });
  }, []);

  const onPressIn = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const handleStartTrial = useCallback(async () => {
    await startTrial();
    await setFirstLaunchDone();
    router.replace('/home');
  }, [startTrial]);

  const handleFreeVersion = useCallback(async () => {
    await setFirstLaunchDone();
    router.replace('/home');
  }, []);

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

        {/* Outcome proof — sample before/after */}
        <View style={styles.outcomeProof}>
          <Text style={styles.outcomeProofLabel}>REAL RESULTS</Text>
          <View style={styles.outcomeProofRow}>
            <View style={styles.outcomeBlock}>
              <Text style={styles.outcomeBlockCap}>BEFORE</Text>
              <Text style={styles.outcomeBlockVal}>7</Text>
              <Text style={styles.outcomeBlockMood}>ANXIOUS</Text>
            </View>
            <View style={styles.outcomeArrowBlock}>
              <Text style={styles.outcomeArrow}>→</Text>
              <Text style={styles.outcomeDelta}>−3 pts</Text>
            </View>
            <View style={styles.outcomeBlock}>
              <Text style={styles.outcomeBlockCap}>AFTER</Text>
              <Text style={[styles.outcomeBlockVal, { color: '#059669' }]}>4</Text>
              <Text style={styles.outcomeBlockMood}>ONE WORKOUT</Text>
            </View>
          </View>
          <Text style={styles.outcomeProofSub}>
            Avg improvement: −2.8 pts per session
          </Text>
        </View>

        <View style={styles.preCTALine} />

        {!hasUsedTrial ? (
          <>
            <View style={styles.trialBanner}>
              <Text style={styles.trialBannerLabel}>7-DAY FREE TRIAL</Text>
              <Text style={styles.trialBannerSub}>Full access. No charge until day 8.</Text>
              <View style={styles.trialFeatures}>
                {TRIAL_FEATURES.map((f) => (
                  <Text key={f} style={styles.trialFeatureItem}>+ {f}</Text>
                ))}
              </View>
            </View>

            <Animated.View style={{ transform: [{ scale: trialScale }] }}>
              <TouchableOpacity
                style={styles.trialButton}
                onPress={handleStartTrial}
                onPressIn={() => onPressIn(trialScale)}
                onPressOut={() => onPressOut(trialScale)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Start 7-day free trial"
              >
                <Text style={styles.trialButtonText}>TRY 7 DAYS FREE →</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.freeButton}
              onPress={handleFreeVersion}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Continue with free version"
            >
              <Text style={styles.freeButtonText}>CONTINUE WITH FREE VERSION</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Animated.View style={{ transform: [{ scale: trialScale }] }}>
            <TouchableOpacity
              style={styles.trialButton}
              onPress={handleFreeVersion}
              onPressIn={() => onPressIn(trialScale)}
              onPressOut={() => onPressOut(trialScale)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Get started"
            >
              <Text style={styles.trialButtonText}>LET&apos;S GO →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

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
    color: '#c8c8c8',
    marginTop: 3,
  },
  outcomeProof: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  outcomeProofLabel: {
    ...t.label,
    color: '#525252',
    letterSpacing: 3,
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 16,
  },
  outcomeProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  outcomeBlockCap: {
    ...t.label,
    color: '#525252',
    letterSpacing: 2,
    fontSize: 9,
    marginBottom: 4,
  },
  outcomeBlockVal: {
    fontSize: 40,
    fontWeight: '700',
    color: '#c8c8c8',
    fontFamily: 'SpaceMono-Regular',
  },
  outcomeBlockMood: {
    ...t.label,
    color: '#333333',
    letterSpacing: 1,
    fontSize: 8,
    marginTop: 4,
  },
  outcomeArrowBlock: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  outcomeArrow: {
    ...t.label,
    color: '#333333',
    fontSize: 20,
  },
  outcomeDelta: {
    ...t.label,
    color: '#059669',
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 4,
  },
  outcomeProofSub: {
    ...t.label,
    color: '#525252',
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 16,
  },
  preCTALine: {
    height: 1,
    backgroundColor: '#1a1a1a',
    width: '100%',
    marginTop: 40,
    marginBottom: 0,
  },
  trialBanner: {
    marginTop: 24,
    marginBottom: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#E8B84B',
    paddingLeft: 16,
  },
  trialBannerLabel: {
    ...t.label,
    color: '#E8B84B',
    letterSpacing: 3,
  },
  trialBannerSub: {
    ...t.bodyMuted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  trialFeatures: {
    gap: 4,
  },
  trialFeatureItem: {
    ...t.bodySm,
    color: '#c8c8c8',
  },
  trialButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
    marginBottom: 12,
  },
  trialButtonText: {
    ...t.button,
    letterSpacing: 4,
  },
  freeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  freeButtonText: {
    ...t.label,
    color: '#a3a3a3',
    letterSpacing: 2,
  },
  disclaimer: {
    ...t.label,
    fontFamily: fonts.mono.regular,
    color: '#c8c8c8',
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 24,
    textTransform: 'none' as const,
  },
});
