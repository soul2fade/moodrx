import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PRICING_TIERS, PRICING_FEATURES, tierValue, type TierKey } from '@/lib/pricing-tiers';
import { fonts } from '@/lib/typography';

interface Props {
  /** Live price overrides keyed by tier; falls back to PRICING_TIERS defaults. */
  prices?: Partial<Record<TierKey, string>>;
}

export function PricingComparison({ prices }: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Pricing comparison">
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.featureCol} />
        {PRICING_TIERS.map((t) => (
          <View key={t.key} style={styles.tierCol}>
            <Text style={[styles.tierName, { color: t.color }]} numberOfLines={1}>{t.name}</Text>
            <Text style={styles.tierPrice} numberOfLines={1}>{prices?.[t.key] ?? t.price}</Text>
          </View>
        ))}
      </View>

      {PRICING_FEATURES.map((f) => (
        <View key={f.label} style={styles.featureRow}>
          <Text style={styles.featureLabel}>{f.label}</Text>
          {PRICING_TIERS.map((t) => {
            const included = tierValue(f, t.key);
            return (
              <View key={t.key} style={styles.tierCol}>
                <Text
                  style={[styles.cell, { color: included ? t.color : '#55554f' }]}
                  accessibilityLabel={`${f.label}: ${included ? 'included' : 'not included'} in ${t.name}`}
                >
                  {included ? '✓' : '–'}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Terms footer */}
      <View style={[styles.featureRow, styles.termsRow]}>
        <View style={styles.featureCol} />
        {PRICING_TIERS.map((t) => (
          <View key={t.key} style={styles.tierCol}>
            <Text style={[styles.terms, { color: t.color }]} numberOfLines={2}>{t.terms}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const COL_W = 52;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0c0c0b',
    borderWidth: 1,
    borderColor: '#2a2a26',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a26',
  },
  featureCol: { flex: 1 },
  tierCol: { width: COL_W, alignItems: 'center' },
  tierName: { fontFamily: fonts.primary.bold, fontSize: 13, lineHeight: 16 },
  tierPrice: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#94938b', lineHeight: 14, marginTop: 2 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c19',
  },
  featureLabel: { flex: 1, fontFamily: fonts.primary.regular, fontSize: 13, color: '#d8d8d2', lineHeight: 17, paddingRight: 6 },
  cell: { fontSize: 15, lineHeight: 18, textAlign: 'center' },
  termsRow: { borderBottomWidth: 0, paddingTop: 11, paddingBottom: 0 },
  terms: { fontFamily: fonts.mono.regular, fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
});
