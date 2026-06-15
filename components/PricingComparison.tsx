import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PRICING_TIERS, PRICING_FEATURES, tierValue, type TierKey } from '@/lib/pricing-tiers';
import { fonts } from '@/lib/typography';

interface Props {
  /** Live price overrides keyed by tier; falls back to PRICING_TIERS defaults. */
  prices?: Partial<Record<TierKey, string>>;
}

/**
 * Stacked tier cards (the spec-approved fallback to the 3-column matrix, which
 * read cramped at phone width and forced sub-12px fonts). One full-width card
 * per tier means every label clears the 16px readability floor with no lint
 * suppressions. Each card lists all features: included rows get a tier-colored
 * ✓, excluded rows get a – and a strikethrough. Excluded text stays LIGHT (the
 * readability guard forbids dim grey TEXT) — the strikethrough carries the
 * "not included" signal instead of dimming.
 */
export function PricingComparison({ prices }: Props) {
  return (
    <View accessibilityRole="summary" accessibilityLabel="Pricing comparison">
      {PRICING_TIERS.map((t) => (
        <View
          key={t.key}
          style={[styles.card, { borderLeftColor: t.color }]}
          accessibilityLabel={`${t.name}, ${prices?.[t.key] ?? t.price}, ${t.terms}`}
        >
          <View style={styles.header}>
            <Text style={[styles.tierName, { color: t.color }]} numberOfLines={1}>{t.name}</Text>
            <View style={styles.priceBlock}>
              <Text style={styles.price} numberOfLines={1}>{prices?.[t.key] ?? t.price}</Text>
              <Text style={styles.terms} numberOfLines={1}>{t.terms}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {PRICING_FEATURES.map((f) => {
            const included = tierValue(f, t.key);
            return (
              <View key={f.label} style={styles.featureRow}>
                <Text
                  style={[styles.glyph, { color: included ? t.color : '#cfcfcf' }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {included ? '✓' : '–'}
                </Text>
                <Text
                  style={[styles.featureLabel, included ? styles.featureOn : styles.featureOff]}
                  accessibilityLabel={`${f.label}: ${included ? 'included' : 'not included'}`}
                >
                  {f.label}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0c0c0b',
    borderWidth: 1,
    borderColor: '#2a2a26',
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tierName: { fontFamily: fonts.primary.bold, fontSize: 20, lineHeight: 26 },
  priceBlock: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.mono.bold, fontSize: 24, color: '#ffffff', lineHeight: 28 },
  terms: { fontFamily: fonts.primary.regular, fontSize: 16, color: '#cfcfcf', lineHeight: 20, marginTop: 1 },
  divider: {
    height: 1,
    backgroundColor: '#2a2a26',
    marginVertical: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  glyph: { fontSize: 16, lineHeight: 22, width: 22, textAlign: 'center' },
  featureLabel: { flex: 1, fontFamily: fonts.primary.regular, fontSize: 16, lineHeight: 22, marginLeft: 8 },
  featureOn: { color: '#e8e8e8' },
  featureOff: { color: '#cfcfcf', textDecorationLine: 'line-through' },
});
