import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BASE_UNLOCK_PACKAGE_ID } from '@/lib/revenuecat';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

interface PremiumSheetProps {
  visible: boolean;
  onClose: () => void;
  headline?: string;
  description?: string;
}

export function PremiumSheet({
  visible,
  onClose,
  headline = 'Unlock all 18 workouts.',
  description = '3 science-backed options for every mood state. Plus supplement tracking, full insights, and the neuroscience behind every rep.',
}: PremiumSheetProps) {
  const { purchaseBase, offerings } = useSubscription();

  const basePkg = offerings?.current?.availablePackages?.find((p) => p.identifier === BASE_UNLOCK_PACKAGE_ID);
  const basePrice = basePkg?.product?.priceString ?? '$9.99';

  const openURL = (url: string) => {
    void Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Visit soul2fade.github.io/moodrx in your browser.')
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={styles.yearlyButton}
          onPress={async () => { await purchaseBase(); onClose(); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Unlock MoodRx Pro, ${basePrice} one time`}
        >
          <Text style={styles.planPrice}>UNLOCK MOODRX PRO — {basePrice}</Text>
          <Text style={styles.planSub}>One-time purchase. Yours forever.</Text>
        </TouchableOpacity>

        <Text style={styles.subDisclosure}>
          One-time purchase — no subscription, no auto-renew.
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

        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.closeText}>NOT NOW</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  handle: {
    width: 32,
    height: 2,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginBottom: 24,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 24,
  },
  description: {
    ...t.bodyMuted,
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 20,
  },
  yearlyButton: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
  },
  planPrice: {
    ...t.headlineSm,
    color: colors.premium,
  },
  planSub: {
    ...t.bodySm,
    color: '#ffffff',
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  subDisclosure: { ...t.softMuted, textAlign: 'center', lineHeight: 16, marginBottom: 14 },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  legalDot: { ...t.softMuted },
});
