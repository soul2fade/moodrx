import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { type as t } from '@/lib/typography';
import { TERMS_URL, PRIVACY_URL, openExternal } from '@/lib/links';

/** Shared "TERMS OF USE · PRIVACY POLICY" row used by the paywall sheets and the
 *  onboarding / premium screens. Single-sources the links, handler, and styling
 *  that were copy-pasted across those surfaces. `style` overrides the container
 *  margins (callers had different top/bottom spacing). */
export function LegalLinksRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity onPress={() => openExternal(TERMS_URL)} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel="Terms of Use">
        <Text style={styles.linkText}>TERMS OF USE</Text>
      </TouchableOpacity>
      <Text style={styles.dot}>·</Text>
      <TouchableOpacity onPress={() => openExternal(PRIVACY_URL)} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel="Privacy Policy">
        <Text style={styles.linkText}>PRIVACY POLICY</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 },
  linkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  dot: { ...t.softMuted },
});
