import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  BackHandler,
  Linking,
  Alert,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { selectBasePrice } from '@/lib/offer-copy';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { OfferProof } from '@/components/OfferProof';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURES = [
  '18 science-backed workouts',
  'The neuroscience behind every rep',
  'Supplement tracker with research',
  'Full progress history and patterns',
  'Calendar view',
  'Daily reminders',
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const {
    purchaseBase,
    restorePurchases,
    isPremium,
    offerings,
    isLoading: subLoading,
  } = useSubscription();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  const basePrice = selectBasePrice(offerings);

  const baseBtn = usePurchaseButton({
    // Enabled once RevenueCat init has settled (success OR failure) — not gated on
    // offerings being non-null, so a failed/empty offerings load can't trap the
    // button in an infinite spinner (and the __DEV__ mock-purchase path stays reachable).
    offeringsLoaded: !subLoading,
    owned: isPremium,
    run: purchaseBase,
  });
  const restoreBtn = usePurchaseButton({
    offeringsLoaded: true, // restore doesn't depend on offerings
    run: restorePurchases,
  });

  const openURL = (url: string) => {
    void Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Visit soul2fade.github.io/moodrx in your browser.')
    );
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0a0a0a', opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 56) }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>

        <Text style={styles.proLabel}>MOODRX PRO</Text>
        <Text style={styles.headline}>The full prescription.</Text>

        <View style={styles.divider} />

        <Text style={styles.subtext}>Your brain deserves the upgrade.</Text>

        {isPremium && baseBtn.phase === 'idle' ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>YOU HAVE PRO</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, baseBtn.disabled && styles.ctaButtonDisabled]}
            onPress={baseBtn.onPress}
            disabled={baseBtn.disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: baseBtn.disabled, busy: baseBtn.busy }}
            accessibilityLabel={`Unlock MoodRx Pro, ${basePrice} one time`}
          >
            {baseBtn.busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.ctaText}>
                {purchaseButtonLabel(baseBtn.status, { idle: `UNLOCK MOODRX PRO — ${basePrice} →` })}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <OfferProof />

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.checkmark}>+</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.legalBlock}>
          <Text style={styles.legalDisclosure}>
            One-time purchase of {basePrice}. No subscription, no auto-renew. Payment is charged to your App Store or Google Play account at confirmation.
          </Text>
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
        </View>

        <TouchableOpacity
          onPress={restoreBtn.onPress}
          disabled={restoreBtn.disabled}
          activeOpacity={0.7}
          style={styles.restoreButton}
          accessibilityRole="button"
          accessibilityState={{ disabled: restoreBtn.disabled, busy: restoreBtn.busy }}
          accessibilityLabel="Restore purchases"
        >
          {restoreBtn.busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.restoreText}>
              {purchaseButtonLabel(restoreBtn.status, { idle: 'RESTORE PURCHASES', success: 'RESTORED ✓' })}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/packs' as Href)}
          activeOpacity={0.7}
          style={styles.restoreButton}
          accessibilityRole="button"
          accessibilityLabel="Browse packs"
        >
          <Text style={styles.restoreText}>BROWSE PACKS →</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 32 },
  backButton: { ...t.label, color: '#ffffff', letterSpacing: 2 },
  proLabel: { ...t.label, color: colors.premium, letterSpacing: 4, marginTop: 24 },
  headline: { ...t.headline, fontSize: 32, marginTop: 8 },
  divider: { width: 32, height: 1, backgroundColor: '#333333', marginVertical: 20 },
  subtext: { ...t.bodyMuted, color: '#ffffff' },
  statusBadge: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { ...t.label, color: colors.premium, letterSpacing: 2 },
  featureList: { marginTop: 24 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  checkmark: { ...t.label, color: colors.premium, fontSize: 16, paddingTop: 1 },
  featureText: { ...t.body, flex: 1 },
  ctaButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  ctaButtonDisabled: { borderColor: '#555555', opacity: 0.6 },
  ctaText: { ...t.button, letterSpacing: 3 },
  legalBlock: { marginTop: 8, marginBottom: 8 },
  legalDisclosure: { ...t.softMuted, textAlign: 'center', lineHeight: 17 },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  legalDot: { ...t.softMuted },
  restoreButton: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { ...t.label, color: '#ffffff', letterSpacing: 2 },
});
