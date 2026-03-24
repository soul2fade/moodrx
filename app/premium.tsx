import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { type as t } from '@/lib/typography';

const FEATURES = [
  '18 science-backed workouts',
  'The neuroscience behind every rep',
  'Supplement tracker with research',
  'Full progress history and patterns',
  'Calendar view',
  'Daily reminders',
];

export default function PremiumScreen() {
  const { purchaseMonthly, purchaseYearly, restorePurchases, isPremium } = useSubscription();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0a0a0a', opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>

        <Text style={styles.proLabel}>MOODRX PRO</Text>
        <Text style={styles.headline}>The full prescription.</Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>Your brain deserves the upgrade.</Text>

        {isPremium && (
          <View style={styles.alreadyPremium}>
            <Text style={styles.alreadyPremiumText}>YOU HAVE PRO</Text>
          </View>
        )}

        {/* Feature list */}
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.checkmark}>+</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Pricing */}
        <Text style={styles.pricingLabel}>CHOOSE YOUR PLAN</Text>

        <TouchableOpacity
          style={styles.yearlyCard}
          onPress={purchaseYearly}
          activeOpacity={0.8}
          disabled={isPremium}
          accessibilityRole="button"
          accessibilityLabel="Yearly plan, $49.99 per year, save 40%"
        >
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <Text style={styles.yearlyPrice}>
            $49.99 <Text style={styles.yearlyPer}>/ year</Text>
          </Text>
          <Text style={styles.yearlySub}>save 40% — $4.17/month</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthlyCard}
          onPress={purchaseMonthly}
          activeOpacity={0.8}
          disabled={isPremium}
          accessibilityRole="button"
          accessibilityLabel="Monthly plan, $6.99 per month"
        >
          <Text style={styles.monthlyPrice}>
            $6.99 <Text style={styles.monthlyPer}>/ month</Text>
          </Text>
        </TouchableOpacity>

        {/* Trial CTA */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={purchaseYearly}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start 7-day free trial"
          >
            <Text style={styles.ctaText}>START 7-DAY FREE TRIAL</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.cancelNote}>Cancel anytime. No commitment.</Text>

        <TouchableOpacity
          onPress={restorePurchases}
          activeOpacity={0.7}
          style={styles.restoreButton}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          <Text style={styles.restoreText}>RESTORE PURCHASES</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 32 },
  backButton: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
  proLabel: { ...t.label, color: '#E8B84B', letterSpacing: 4, marginTop: 24 },
  headline: { ...t.headline, fontSize: 32, marginTop: 8 },
  divider: { width: 32, height: 1, backgroundColor: '#333333', marginVertical: 20 },
  subtext: { ...t.bodyMuted, color: '#c8c8c8' },
  alreadyPremium: {
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  alreadyPremiumText: { ...t.label, color: '#E8B84B', letterSpacing: 2 },
  featureList: { marginTop: 24 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  checkmark: { ...t.label, color: '#E8B84B', fontSize: 14, paddingTop: 1 },
  featureText: { ...t.body, flex: 1 },
  pricingLabel: { ...t.label, color: '#c8c8c8', letterSpacing: 3, marginTop: 24, marginBottom: 16 },
  yearlyCard: {
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#E8B84B',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bestValueText: { ...t.label, color: '#0a0a0a', fontSize: 9, letterSpacing: 1 },
  yearlyPrice: { ...t.headlineMd, color: '#E8B84B' },
  yearlyPer: { ...t.bodyMuted, color: '#c8c8c8', fontSize: 16 },
  yearlySub: { ...t.bodySm, color: '#c8c8c8', marginTop: 4 },
  monthlyCard: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  monthlyPrice: { ...t.headlineSm, color: '#c8c8c8' },
  monthlyPer: { ...t.bodyMuted, color: '#c8c8c8', fontSize: 14 },
  ctaButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: { ...t.button, letterSpacing: 3 },
  cancelNote: { ...t.softMuted, textAlign: 'center', marginBottom: 16 },
  restoreButton: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { ...t.label, color: '#c8c8c8', letterSpacing: 2 },
});