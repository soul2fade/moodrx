import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLUS_OFFERING_ID } from '@/lib/revenuecat';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';
import { LegalLinksRow } from '@/components/LegalLinksRow';
import { PurchaseSheetShell } from '@/components/PurchaseSheetShell';

const MONTHLY_PKG = '$rc_monthly';
const ANNUAL_PKG = '$rc_annual';

export function PlusSheet({ visible, onClose, onPurchased }: { visible: boolean; onClose: () => void; onPurchased?: () => void }) {
  const { purchasePlus, purchaseBase, restorePurchases, offerings, isLoading: subLoading } = useSubscription();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');

  const pkgs = offerings?.all?.[PLUS_OFFERING_ID]?.availablePackages ?? [];
  const priceOf = (id: string, fallback: string) =>
    pkgs.find((p) => p.identifier === id)?.product?.priceString ?? fallback;
  const monthlyPrice = priceOf(MONTHLY_PKG, '$3.99');
  const annualPrice = priceOf(ANNUAL_PKG, '$24.99');

  // Annual vs paying monthly for a year — show the real discount as a number
  // ("SAVE 48%"), computed from live prices so it tracks any price change.
  // Falls back to the known $24.99-vs-$3.99×12 figure before offerings load.
  const monthlyNum = pkgs.find((p) => p.identifier === MONTHLY_PKG)?.product?.price ?? 3.99;
  const annualNum = pkgs.find((p) => p.identifier === ANNUAL_PKG)?.product?.price ?? 24.99;
  const yearlyIfMonthly = monthlyNum * 12;
  const annualSavingsPct =
    yearlyIfMonthly > 0 ? Math.round((1 - annualNum / yearlyIfMonthly) * 100) : 0;
  const annualSavingsTag = annualSavingsPct > 0 ? `SAVE ${annualSavingsPct}%` : undefined;

  const trialBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    run: () => purchasePlus(period),
    onSuccess: () => { onPurchased?.(); onClose(); },
  });
  const baseBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    run: purchaseBase,
    onSuccess: () => { onPurchased?.(); onClose(); },
  });
  const restoreBtn = usePurchaseButton({
    offeringsLoaded: true,
    run: restorePurchases,
    onSuccess: onClose,
  });

  const PlanRow = ({ id, label, price, suffix, tag }: { id: 'monthly' | 'annual'; label: string; price: string; suffix: string; tag?: string }) => {
    const selected = period === id;
    return (
      <Pressable
        style={[styles.planRow, selected && styles.planRowSelected]}
        onPress={() => setPeriod(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${price} ${suffix}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.planLabel}>{label}</Text>
          <Text style={styles.planPrice}>{price} {suffix}</Text>
        </View>
        {tag ? <Text style={styles.planTag}>{tag}</Text> : null}
      </Pressable>
    );
  };

  return (
    <PurchaseSheetShell visible={visible} onClose={onClose} restoreBtn={restoreBtn}>
        <Text style={styles.headline}>Keep the live coach.</Text>
        <Text style={styles.description}>Live Dr. MoodRx + every coach personality + new content packs.</Text>
        <Text style={styles.trialLine}>7 days free, then your plan.</Text>

        <PlanRow id="annual" label="Annual" price={annualPrice} suffix="/yr" tag={annualSavingsTag} />
        <PlanRow id="monthly" label="Monthly" price={monthlyPrice} suffix="/mo" />

        <TouchableOpacity
          style={[styles.cta, trialBtn.disabled && styles.ctaDisabled]}
          onPress={trialBtn.onPress}
          disabled={trialBtn.disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: trialBtn.disabled, busy: trialBtn.busy }}
          accessibilityLabel="Start 7-day free trial"
        >
          {trialBtn.busy ? (
            <ActivityIndicator size="small" color={colors.premium} />
          ) : (
            <Text style={styles.ctaText}>{purchaseButtonLabel(trialBtn.status, { idle: 'START 7-DAY FREE TRIAL' })}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.softLanding}
          onPress={baseBtn.onPress}
          disabled={baseBtn.disabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ disabled: baseBtn.disabled, busy: baseBtn.busy }}
          accessibilityLabel="Own the core once for $9.99"
        >
          {baseBtn.busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.softLandingText}>
              {purchaseButtonLabel(baseBtn.status, { idle: 'Own the core once — $9.99', success: "You're in ✓" })}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.renewDisclosure}>
          Free for 7 days, then your selected plan. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the period. Manage or cancel anytime in your App Store settings.
        </Text>

        <LegalLinksRow />
    </PurchaseSheetShell>
  );
}

const styles = StyleSheet.create({
  headline: { ...t.headlineMd, fontSize: 24 },
  description: { ...t.bodyMuted, color: '#ffffff', marginTop: 10 },
  trialLine: { ...t.body, color: colors.premium, fontWeight: '700', marginTop: 14, marginBottom: 12 },
  renewDisclosure: { ...t.bodyMuted, marginTop: 16, lineHeight: 20 },
  planRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  planRowSelected: { borderColor: colors.premium, backgroundColor: '#1a1407' },
  planLabel: { ...t.body, color: '#ffffff', fontWeight: '700' },
  planPrice: { ...t.bodySm, color: '#e8e8e8', marginTop: 2 },
  planTag: { ...t.label, color: colors.premium, letterSpacing: 1.5 },
  cta: { borderWidth: 1, borderColor: colors.premium, paddingVertical: 16, alignItems: 'center', marginTop: 6, marginBottom: 10 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...t.button, color: colors.premium, letterSpacing: 2 },
  softLanding: { alignItems: 'center', paddingVertical: 10, marginBottom: 6 },
  softLandingText: { ...t.body, color: '#ffffff' },
});
