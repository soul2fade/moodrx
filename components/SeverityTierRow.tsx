import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, tintFill } from '@/lib/colors';
import { fonts } from '@/lib/typography';

interface Props {
  label: string;
  blurb: string;
  warning?: string;
  selected: boolean;
  onPress: () => void;
  /** Accent for the selected state's border + tinted fill (red in the severity
   *  sheet; the picked mood's color in the taste tile). */
  accent: string;
  /** Selected label color. Defaults to `accent`; the severity sheet overrides to
   *  white (its selected label was white, not red). */
  selectedLabelColor?: string;
}

/** One selectable burn-level row (label + blurb + optional warning), shared by
 *  the SeveritySheet and the onboarding taste tile. */
export function SeverityTierRow({ label, blurb, warning, selected, onPress, accent, selectedLabelColor }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.row, selected && tintFill(accent, '18')]}
    >
      <Text style={[styles.label, selected && { color: selectedLabelColor ?? accent }]}>{label}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
      {warning ? <Text style={styles.warning}>{warning}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderColor: colors.borderMedium, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  label: { fontFamily: fonts.primary.bold, fontSize: 17, color: '#f0f0f0' },
  blurb: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, marginTop: 3 },
  warning: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, marginTop: 4, letterSpacing: 0.5 },
});
