import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { type as t } from '@/lib/typography';

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
  const { purchaseMonthly, purchaseYearly, offerings } = useSubscription();

  const currentOffering = offerings?.current;
  const monthlyPkg = currentOffering?.availablePackages?.find((p) => p.identifier === '$rc_monthly');
  const yearlyPkg = currentOffering?.availablePackages?.find((p) => p.identifier === '$rc_annual');

  const monthlyPrice = monthlyPkg?.product?.priceString ?? '$6.99';
  const yearlyPrice = yearlyPkg?.product?.priceString ?? '$49.99';

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

        <View style={styles.trialNote}>
          <Text style={styles.trialLabel}>7-DAY FREE TRIAL — CANCEL ANYTIME</Text>
        </View>

        <TouchableOpacity
          style={styles.yearlyButton}
          onPress={purchaseYearly}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Yearly plan, ${yearlyPrice} per year`}
        >
          <View style={styles.bestValue}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <Text style={styles.planPrice}>{yearlyPrice} / year</Text>
          <Text style={styles.planSub}>save 40% — ~$4.17/mo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthlyButton}
          onPress={purchaseMonthly}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Monthly plan, ${monthlyPrice} per month`}
        >
          <Text style={styles.monthlyPrice}>{monthlyPrice} / month</Text>
        </TouchableOpacity>

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
    color: '#c8c8c8',
    marginTop: 10,
    marginBottom: 20,
  },
  trialNote: {
    borderLeftWidth: 2,
    borderLeftColor: '#E8B84B',
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  trialLabel: {
    ...t.label,
    color: '#E8B84B',
    letterSpacing: 2,
  },
  yearlyButton: {
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
  },
  bestValue: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#E8B84B',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bestValueText: {
    ...t.label,
    color: '#0a0a0a',
    fontSize: 9,
    letterSpacing: 1,
  },
  planPrice: {
    ...t.headlineSm,
    color: '#E8B84B',
  },
  planSub: {
    ...t.bodySm,
    color: '#c8c8c8',
    marginTop: 2,
  },
  monthlyButton: {
    borderWidth: 1,
    borderColor: '#525252',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthlyPrice: {
    ...t.headlineSm,
    color: '#c8c8c8',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
});