import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

/**
 * The one locked-state affordance (spec §6): a small gold "PRO" chip that opens
 * the offer sheet (the price lives in the sheet, not on the lock). `label`
 * overrides the default "Unlock Pro" for context (e.g. "+3 more patterns — Pro").
 * Pass `center` for hero locks (e.g. the calendar overlay) where the chip should
 * sit centered rather than left-aligned.
 */
export function PriceChip({
  onPress,
  label,
  accessibilityLabel,
  center,
  tint,
}: {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  center?: boolean;
  /** Override the gold default — e.g. the mood accent on the prescription screen. */
  tint?: string;
}) {
  const text = label ?? 'Unlock Pro';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, center && styles.chipCenter, tint ? { borderColor: tint } : null]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
    >
      <Text style={[styles.chipText, tint ? { color: tint } : null]}>{text}</Text>
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
  chipCenter: { alignSelf: 'center' },
  chipText: { ...t.label, color: colors.premium, letterSpacing: 1.5 },
});
