import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fonts } from '@/lib/typography';

interface IntensityPickerProps {
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
  accessibilityPrefix?: string;
}

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function IntensityPicker({
  value,
  onChange,
  accentColor,
  accessibilityPrefix = 'Intensity',
}: IntensityPickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={`${accessibilityPrefix}: ${value} out of 10`}>
      {VALUES.map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => {
              onChange(n);
              Haptics.selectionAsync();
            }}
            activeOpacity={0.75}
            style={[
              styles.chip,
              selected && { borderColor: accentColor, backgroundColor: accentColor + '22' },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${accessibilityPrefix} ${n} out of 10`}
          >
            <Text style={[styles.chipText, selected && { color: accentColor }]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#999999',
    lineHeight: 18,
  },
});
