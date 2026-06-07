import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface IntensityPickerProps {
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
  accessibilityPrefix?: string;
}

export function IntensityPicker({
  value,
  onChange,
  accentColor,
  accessibilityPrefix = 'Intensity',
}: IntensityPickerProps) {
  return (
    <View style={styles.container}>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor="#1a1a1a"
        thumbTintColor={accentColor}
        accessibilityLabel={accessibilityPrefix}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 1, max: 10, now: value, text: `${value} out of 10` }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 36,
  },
});
