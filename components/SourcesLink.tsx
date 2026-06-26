import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { type as t } from '@/lib/typography';

/** Always-visible tappable pointer to the central "The Science" screen.
 *  Placed wherever the app makes a health/medical claim so citations are
 *  one tap away and easy for the user to find. */
export function SourcesLink({
  label = 'SOURCES & SCIENCE →',
  color = '#8fd6b4',
  style,
}: {
  label?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={() => router.push('/sources' as Href)}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={style}
      accessibilityRole="link"
      accessibilityLabel="View the science and sources"
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: {
    ...t.label,
    fontSize: 16,
    letterSpacing: 1.5,
  },
});
