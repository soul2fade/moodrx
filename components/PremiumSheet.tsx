import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { offerHeadline, selectBasePrice, CANONICAL_REASSURANCE, type OfferContext } from '@/lib/offer-copy';
import { OfferProof } from '@/components/OfferProof';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

interface PremiumSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Entry point — drives the contextual headline. */
  context?: OfferContext;
}

export function PremiumSheet({ visible, onClose, context = 'default' }: PremiumSheetProps) {
  const { purchaseBase, restorePurchases, offerings, isLoading: subLoading } = useSubscription();

  const basePrice = selectBasePrice(offerings);

  const buyBtn = usePurchaseButton({
    // Gate on init settled, not offerings-present, so a failed offerings load
    // can't trap the button spinning forever (and __DEV__ mock-purchase works).
    offeringsLoaded: !subLoading,
    run: purchaseBase,
    // Flash "You're in ✓", then close — revealing the now-unlocked content behind.
    onSuccess: onClose,
  });

  const restoreBtn = usePurchaseButton({
    offeringsLoaded: true,
    run: restorePurchases,
    onSuccess: onClose,
  });

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
        <Text style={styles.headline}>{offerHeadline(context)}</Text>
        <Text style={styles.description}>{CANONICAL_REASSURANCE}</Text>
        <OfferProof />
        <View style={styles.proofSpacer} />

        <TouchableOpacity
          style={[styles.buyButton, buyBtn.disabled && styles.buyButtonDisabled]}
          onPress={buyBtn.onPress}
          disabled={buyBtn.disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: buyBtn.disabled, busy: buyBtn.busy }}
          accessibilityLabel={`Unlock MoodRx Pro, ${basePrice} one time`}
        >
          {buyBtn.busy ? (
            <ActivityIndicator size="small" color={colors.premium} />
          ) : buyBtn.status === 'success' ? (
            <Text style={styles.planPrice}>You&apos;re in ✓</Text>
          ) : (
            <>
              <Text style={styles.planPrice}>UNLOCK MOODRX PRO — {basePrice}</Text>
              <Text style={styles.planSub}>One-time purchase. Yours forever.</Text>
            </>
          )}
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

        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={restoreBtn.onPress}
            disabled={restoreBtn.disabled}
            activeOpacity={0.7}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: restoreBtn.disabled, busy: restoreBtn.busy }}
            accessibilityLabel="Restore purchase"
          >
            {restoreBtn.busy ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.closeText}>
                {purchaseButtonLabel(restoreBtn.status, { idle: 'RESTORE PURCHASE', success: 'RESTORED ✓' })}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
          >
            <Text style={styles.closeText}>MAYBE LATER</Text>
          </TouchableOpacity>
        </View>
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
  buyButton: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
  },
  buyButtonDisabled: { opacity: 0.6 },
  proofSpacer: { height: 20 },
  planPrice: {
    ...t.headlineSm,
    color: colors.premium,
  },
  planSub: {
    ...t.bodySm,
    color: '#ffffff',
    marginTop: 2,
  },
  closeText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  legalDot: { ...t.softMuted },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
});
