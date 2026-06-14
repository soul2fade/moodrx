import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { selectBasePrice, chipLabel } from '@/lib/offer-copy';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

/**
 * The one locked-state affordance (spec §6): a small dimmed chip that always
 * shows the price on the lock and opens the offer sheet. `label` overrides the
 * default "$X unlocks this" for context (e.g. "$9.99 unlocks all 18").
 */
export function PriceChip({
  onPress,
  label,
  accessibilityLabel,
}: {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}) {
  const { offerings } = useSubscription();
  const text = label ?? chipLabel(selectBasePrice(offerings));
  return (
    <Pressable
      onPress={onPress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
    >
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipText: { ...t.label, color: colors.premium, letterSpacing: 1.5 },
});
