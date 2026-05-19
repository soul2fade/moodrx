import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { fonts } from '@/lib/typography';

const TABS = [
  { label: 'CHECK-IN', path: '/home' },
  { label: 'INSIGHTS', path: '/insights' },
  { label: 'SETTINGS', path: '/settings' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeLine} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    paddingBottom: 32,
    paddingTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#3a3a3a',
    letterSpacing: 2,
  },
  labelActive: {
    color: '#c8c8c8',
  },
  activeLine: {
    width: 16,
    height: 1,
    backgroundColor: '#c8c8c8',
  },
});
