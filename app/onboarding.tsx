import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { getFirstLaunchDone, setFirstLaunchDone } from '@/lib/storage';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { colors } from '@/lib/colors';

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
  const { purchaseBase, isLoading: subLoading } = useSubscription();

  useEffect(() => {
    getFirstLaunchDone().then((done) => {
      if (done) router.replace('/home');
    });
  }, []);

  const onPressIn = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  // Only advances on a real unlock. On cancel/error the hook returns to idle so
  // the user can retry or pick "Continue with free version".
  const unlockBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    run: purchaseBase,
    onSuccess: () => {
      // After the "You're in ✓" flash, drop straight into the guided flow.
      void setFirstLaunchDone().then(() => router.replace('/guided'));
    },
  });

  const handleFreeVersion = useCallback(async () => {
    await setFirstLaunchDone();
    router.replace('/guided');
  }, []);

  const openURL = (url: string) => {
    void Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Visit soul2fade.github.io/moodrx in your browser.')
    );
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

        {/* Outcome proof — illustrative example, not aggregate stats */}
        <View style={styles.outcomeProof}>
          <Text style={styles.outcomeProofLabel}>EXAMPLE SESSION</Text>
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
            Your before/after scores build your personal evidence file.
          </Text>
        </View>

        <View style={styles.preCTALine} />

        <Text style={styles.wellnessDisclaimer}>
          MoodRx is a wellness tool, not a substitute for professional mental health care.
        </Text>

        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerLabel}>MOODRX PRO</Text>
          <Text style={styles.trialBannerSub}>One-time unlock. Full access forever.</Text>
          <View style={styles.trialFeatures}>
            {TRIAL_FEATURES.map((f) => (
              <Text key={f} style={styles.trialFeatureItem}>+ {f}</Text>
            ))}
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: trialScale }] }}>
          <TouchableOpacity
            style={[styles.trialButton, unlockBtn.disabled && styles.trialButtonDisabled]}
            onPress={unlockBtn.onPress}
            onPressIn={() => onPressIn(trialScale)}
            onPressOut={() => onPressOut(trialScale)}
            disabled={unlockBtn.disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: unlockBtn.disabled, busy: unlockBtn.busy }}
            accessibilityLabel="Unlock MoodRx Pro"
          >
            {unlockBtn.busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.trialButtonText}>
                {purchaseButtonLabel(unlockBtn.status, { idle: 'UNLOCK MOODRX PRO →' })}
              </Text>
            )}
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

        <View style={styles.legalLinksRow}>
          <TouchableOpacity
            onPress={() => openURL('https://soul2fade.github.io/moodrx/terms.html')}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
          >
            <Text style={styles.legalLinkText}>TERMS OF USE</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity
            onPress={() => openURL('https://soul2fade.github.io/moodrx/privacy-policy.html')}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.legalLinkText}>PRIVACY POLICY</Text>
          </TouchableOpacity>
        </View>

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
    fontSize: 39,
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
    fontSize: 18,
    textAlign: 'center',
  },
  body: {
    ...t.softMuted,
    fontSize: 16,
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
    color: colors.accent,
    paddingTop: 2,
    minWidth: 28,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    ...t.headlineSm,
    fontSize: 17,
  },
  stepSub: {
    ...t.bodySm,
    color: '#ffffff',
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
    color: '#ffffff',
    letterSpacing: 3,
    fontSize: 16,
    lineHeight: 17,
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
    color: '#ffffff',
    letterSpacing: 2,
    fontSize: 16,
    lineHeight: 17,
    marginBottom: 4,
  },
  outcomeBlockVal: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: fonts.mono.bold,
  },
  outcomeBlockMood: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 1,
    fontSize: 16,
    lineHeight: 17,
    marginTop: 4,
  },
  outcomeArrowBlock: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  outcomeArrow: {
    ...t.label,
    color: '#ffffff',
    fontSize: 20,
  },
  outcomeDelta: {
    ...t.label,
    color: '#059669',
    fontSize: 16,
    lineHeight: 17,
    letterSpacing: 1,
    marginTop: 4,
  },
  outcomeProofSub: {
    ...t.label,
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 17,
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
  wellnessDisclaimer: {
    ...t.label,
    color: '#ffffff',
    fontSize: 16,
    letterSpacing: 0.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
    textTransform: 'none' as const,
  },
  trialBanner: {
    marginTop: 24,
    marginBottom: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.premium,
    paddingLeft: 16,
  },
  trialBannerLabel: {
    ...t.label,
    color: colors.premium,
    letterSpacing: 3,
  },
  trialBannerSub: {
    ...t.bodyMuted,
    fontSize: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  trialFeatures: {
    gap: 4,
  },
  trialFeatureItem: {
    ...t.bodySm,
    color: '#ffffff',
  },
  trialButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
    marginBottom: 12,
  },
  trialButtonDisabled: {
    borderColor: '#555555',
    opacity: 0.6,
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
    color: '#ffffff',
    letterSpacing: 2,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  legalDot: { ...t.softMuted },
  disclaimer: {
    ...t.label,
    fontFamily: fonts.mono.regular,
    color: '#ffffff',
    fontSize: 16,
    letterSpacing: 0.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 24,
    textTransform: 'none' as const,
  },
});
